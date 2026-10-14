import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/Toast";
import { SubjectSummary, SimulatedScenarioResult } from "../../types";

interface WhatIfSimulatorProps {
  subjects: SubjectSummary[];
  semesterId: string;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  subjects,
  semesterId,
}) => {
  const toast = useToast();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.subjectId || ""
  );

  React.useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].subjectId);
    }
  }, [subjects, selectedSubjectId]);

  // Selected simulations map: sessionId -> "ATTEND" | "MISS"
  const [simulations, setSimulations] = useState<Record<string, "ATTEND" | "MISS">>({});
  const [simulationResult, setSimulationResult] = useState<SimulatedScenarioResult | null>(null);

  // Fetch upcoming pending sessions for the selected subject
  const { data: historyData, isLoading: isUpcomingLoading } = useQuery({
    queryKey: ["upcomingSessions", selectedSubjectId, semesterId],
    queryFn: () =>
      api.getAttendanceHistory({
        semesterId,
        subjectId: selectedSubjectId,
        status: "PENDING",
        limit: 15,
      }),
    enabled: !!selectedSubjectId,
  });

  const upcomingSessions = historyData?.records || [];

  const simulateMutation = useMutation({
    mutationFn: async (payload: {
      subjectId: string;
      semesterId: string;
      simulatedSessions: { sessionId: string; action: "ATTEND" | "MISS" }[];
    }) => {
      return await api.simulateAttendance(payload);
    },
    onSuccess: (data) => {
      setSimulationResult(data);
      toast.success("Simulation calculated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to run simulation");
    },
  });

  const toggleSessionAction = (sessionId: string, action: "ATTEND" | "MISS") => {
    setSimulations((prev) => {
      const next = { ...prev };
      if (next[sessionId] === action) {
        delete next[sessionId];
      } else {
        next[sessionId] = action;
      }
      return next;
    });
  };

  const handleRunSimulation = () => {
    const simulatedSessions = Object.entries(simulations).map(
      ([sessionId, action]) => ({
        sessionId,
        action,
      })
    );

    if (simulatedSessions.length === 0) {
      toast.error("Select at least one upcoming class to simulate attending or missing.");
      return;
    }

    simulateMutation.mutate({
      subjectId: selectedSubjectId,
      semesterId,
      simulatedSessions,
    });
  };

  const handleReset = () => {
    setSimulations({});
    setSimulationResult(null);
  };

  const selectedCount = Object.keys(simulations).length;
  const currentSub = subjects.find((s) => s.subjectId === selectedSubjectId);

  return (
    <Card
      title="What-If Attendance Simulator"
      subtitle="Simulate attending or skipping upcoming scheduled classes without modifying database records"
      headerAction={
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset ({selectedCount})
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleRunSimulation}
            disabled={selectedCount === 0}
            isLoading={simulateMutation.isPending}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Simulate ({selectedCount})
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Subject selector tabs */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Select Subject to Simulate
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {subjects.map((sub) => {
              const isSelected = sub.subjectId === selectedSubjectId;
              return (
                <button
                  key={sub.subjectId}
                  onClick={() => {
                    setSelectedSubjectId(sub.subjectId);
                    handleReset();
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border whitespace-nowrap transition-all flex items-center gap-2 ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span>{sub.subjectName}</span>
                  <span className="font-mono text-[10px] text-slate-400 uppercase">
                    ({sub.subjectCode})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Baseline Pill */}
        {currentSub && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-600">
              Current Record:{" "}
              <strong>
                {currentSub.conductedSessions > 0
                  ? `${currentSub.currentPercentage?.toFixed(1)}%`
                  : "—"}{" "}
                ({currentSub.attendedSessions}/{currentSub.conductedSessions})
              </strong>
            </span>
            <span className="text-slate-600">
              Target: <strong>{currentSub.targetPercent}%</strong>
            </span>
            <span className="text-slate-600">
              Safe Bunks: <strong>{currentSub.safeBunks}</strong>
            </span>
            <span className="text-slate-600">
              Remaining: <strong>{currentSub.remainingSessions}</strong>
            </span>
          </div>
        )}

        {/* Simulation Output Card (When generated) */}
        {simulationResult && (
          <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Simulation Results
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">
                  {simulationResult.subjectName} ({simulationResult.subjectCode})
                </h4>
              </div>

              <Badge
                variant={
                  simulationResult.projectedMetrics.willMeetTarget
                    ? "SAFE"
                    : "CRITICAL"
                }
              >
                {simulationResult.projectedMetrics.willMeetTarget
                  ? "Meets Target"
                  : "Below Target"}
              </Badge>
            </div>

            {/* Projected Metrics Comparison */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-indigo-100">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Projected %
                </p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {simulationResult.projectedMetrics.projectedPercentage?.toFixed(1)}%
                </p>
                <span className="text-[11px] text-slate-500">
                  ({simulationResult.projectedMetrics.projectedAttended}/
                  {simulationResult.projectedMetrics.projectedConducted})
                </span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  % Change
                </p>
                <p
                  className={`text-xl font-extrabold mt-0.5 ${
                    (simulationResult.projectedMetrics.percentageChange ?? 0) >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {(simulationResult.projectedMetrics.percentageChange ?? 0) >= 0
                    ? `+${simulationResult.projectedMetrics.percentageChange}%`
                    : `${simulationResult.projectedMetrics.percentageChange}%`}
                </p>
                <span className="text-[11px] text-slate-400">vs baseline</span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Safe Bunks
                </p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {simulationResult.projectedMetrics.projectedSafeBunks}
                </p>
                <span className="text-[11px] text-slate-400">cushion left</span>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">
                  Recovery Needed
                </p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {simulationResult.projectedMetrics.projectedRecoveryNeeded}
                </p>
                <span className="text-[11px] text-slate-400">
                  consecutive classes
                </span>
              </div>
            </div>

            {/* Natural language explanation */}
            <div className="p-3.5 rounded-xl bg-white border border-indigo-100 flex items-start gap-3">
              {simulationResult.projectedMetrics.willMeetTarget ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className="font-semibold text-slate-900">
                  Outcome Explanation
                </p>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {simulationResult.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming sessions selection list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Upcoming Schedule (Select Action for Simulation)
            </h4>
            <span className="text-[11px] text-slate-400">
              Click &quot;Attend&quot; or &quot;Miss&quot; to stage hypothetical outcome
            </span>
          </div>

          {isUpcomingLoading ? (
            <div className="py-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500">
                No future pending sessions found for this subject.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((session) => {
                const currentAction = simulations[session.sessionId];
                return (
                  <div
                    key={session.sessionId}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      currentAction === "ATTEND"
                        ? "bg-emerald-50/70 border-emerald-300"
                        : currentAction === "MISS"
                        ? "bg-rose-50/70 border-rose-300"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 text-xs">
                      <p className="font-bold text-slate-900">
                        {session.date} ({session.startTime} - {session.endTime})
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {session.room ? `Room: ${session.room}` : "Classroom session"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          toggleSessionAction(session.sessionId, "ATTEND")
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                          currentAction === "ATTEND"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Attend
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleSessionAction(session.sessionId, "MISS")
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                          currentAction === "MISS"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        Miss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Disclaimer Note */}
        <p className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-2 border-t border-slate-100">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Projections are derived from integer-safe mathematical models based on your scheduled timetable sessions and do not alter your permanent attendance database records.
        </p>
      </div>
    </Card>
  );
};
