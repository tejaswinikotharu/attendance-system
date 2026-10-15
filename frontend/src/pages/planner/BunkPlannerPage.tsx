import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  PlusCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { useSemester } from "../../context/SemesterContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Button } from "../../components/ui/Button";
import { ForecastComparisonChart } from "../../components/charts/ForecastComparisonChart";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { RecoveryPlanner } from "./RecoveryPlanner";

export const BunkPlannerPage: React.FC = () => {
  const { selectedSemester, selectedSemesterId } = useSemester();

  // 1. Fetch live planner subjects & safe bunks
  const {
    data: plannerData,
    isLoading: isPlannerLoading,
    error: plannerError,
  } = useQuery({
    queryKey: ["plannerSubjects", selectedSemesterId],
    queryFn: () => api.getPlannerSubjects(selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  // 2. Fetch semester forward-looking forecasts
  const {
    data: forecastData,
    isLoading: isForecastLoading,
  } = useQuery({
    queryKey: ["semesterForecast", selectedSemesterId],
    queryFn: () => api.getSemesterForecasts({ semesterId: selectedSemesterId || undefined }),
    enabled: !!selectedSemesterId,
  });

  if (!selectedSemester) {
    return (
      <div className="py-12 px-4 text-center max-w-lg mx-auto">
        <Calculator className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">No Semester Configured</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Set up a semester to access smart bunk planning and mathematical projections.
        </p>
        <Link to="/timetable">
          <Button size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            Go to Timetable
          </Button>
        </Link>
      </div>
    );
  }

  const subjects = plannerData?.subjects || [];
  const forecasts = forecastData?.subjects || [];

  const totalSafeBunks = subjects.reduce((acc, s) => acc + s.safeBunks, 0);
  const totalDeficitSubjects = subjects.filter(
    (s) => s.conductedSessions > 0 && !s.isMeetingTarget
  ).length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Smart Bunk Planner & What-If Simulator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Integer-safe safe bunk recommendations, recovery paths, and semester-end projections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="brand">{selectedSemester.name}</Badge>
          <span className="text-xs text-slate-500">
            Target: {selectedSemester.targetPercent}%
          </span>
        </div>
      </div>

      {/* Top Planner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Safe Bunks Available
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {totalSafeBunks}
            </span>
            <span className="text-xs text-slate-500">cumulative safe skips</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Total classes you can safely skip without falling below required thresholds.
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Subjects in Deficit
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold ${
                totalDeficitSubjects > 0 ? "text-amber-600" : "text-slate-900"
              }`}
            >
              {totalDeficitSubjects}
            </span>
            <span className="text-xs text-slate-500">below target attendance</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {totalDeficitSubjects === 0
              ? "All subjects are currently satisfying minimum criteria."
              : "Consecutive attendance recovery required to regain eligibility."}
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mathematical Model
            </span>
            <Calculator className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xs font-semibold text-slate-800">
            Integer-Safe Arithmetic
          </p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Safe bunks: <code>⌊(100·A - T·C)/T⌋</code>
            <br />
            Recovery: <code>⌈(T·C - 100·A)/(100 - T)⌉</code>
          </p>
        </Card>
      </div>

      {/* Subject-Wise Bunk Recommendation Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Subject Recommendations & Safe Bunk Limits
        </h2>

        {isPlannerLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse"
              />
            ))}
          </div>
        ) : plannerError ? (
          <div className="p-6 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700">
            Failed to load subject planner data.
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
            <p className="text-xs">No subjects found in this semester.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjects.map((sub) => {
              const hasClasses = sub.conductedSessions > 0;
              return (
                <Card key={sub.subjectId} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-md shrink-0"
                          style={{ backgroundColor: sub.color }}
                        />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 leading-tight">
                            {sub.subjectName}
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400 uppercase">
                            {sub.subjectCode}
                          </span>
                          {sub.historicalBaseline && (
                            <span
                              className="ml-2 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.5 rounded"
                              title={`Includes Historical Baseline: ${sub.historicalBaseline.present}/${sub.historicalBaseline.total} classes attended`}
                            >
                              Baseline: {sub.historicalBaseline.present}/{sub.historicalBaseline.total}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={sub.statusBadge} size="sm">
                        {sub.statusBadge}
                      </Badge>
                    </div>

                    {/* Numerical Stats */}
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-2xl font-black text-slate-900">
                        {hasClasses ? `${sub.currentPercentage?.toFixed(1)}%` : "—"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {hasClasses
                          ? `${sub.attendedSessions}/${sub.conductedSessions} attended`
                          : "No conducted classes"}
                      </span>
                    </div>

                    <ProgressBar
                      percentage={sub.currentPercentage}
                      target={sub.targetPercent}
                      size="sm"
                    />

                    {/* Bunk / Recovery Metric Highlights */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          Safe Bunks
                        </span>
                        <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                          {sub.safeBunks}
                        </p>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          Recovery Classes
                        </span>
                        <p
                          className={`text-lg font-extrabold mt-0.5 ${
                            sub.requiredToRecover > 0
                              ? "text-rose-600"
                              : "text-slate-900"
                          }`}
                        >
                          {sub.requiredToRecover}
                        </p>
                      </div>
                    </div>

                    {/* Recommendation Narrative */}
                    <div className="mt-3 p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs">
                      <p className="font-semibold text-slate-900">
                        {sub.headline}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {sub.mathematicalExplanation}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: {sub.targetPercent}%</span>
                    <span>Remaining Sessions: {sub.remainingSessions}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Deficit Recovery Planner Section */}
      {selectedSemesterId && (
        <RecoveryPlanner semesterId={selectedSemesterId} />
      )}

      {/* What-If Simulator Section */}
      {selectedSemesterId && subjects.length > 0 && (
        <WhatIfSimulator subjects={subjects} semesterId={selectedSemesterId} />
      )}

      {/* Semester Forecast Analytics Section */}
      <Card
        title="Semester-End Forecast Scenarios"
        subtitle="Simulated end-of-semester attendance outcomes based on future attendance behaviors"
      >
        <div className="space-y-6">
          {isForecastLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Computing forecasts...</p>
            </div>
          ) : (
            <>
              <ForecastComparisonChart
                subjects={forecasts}
                targetPercent={selectedSemester.targetPercent}
              />

              {/* Forecast Scenarios Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Current Attendance</th>
                      <th className="py-3 px-4">Attend All Remaining</th>
                      <th className="py-3 px-4">Miss All Remaining</th>
                      <th className="py-3 px-4">Maintain Current Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {forecasts.map((sub) => (
                      <tr key={sub.subjectId} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sub.color }}
                            />
                            <span>{sub.subjectName}</span>
                            <span className="font-mono text-[10px] text-slate-400">
                              ({sub.subjectCode})
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-700">
                          {sub.currentMetrics.currentPercentage !== null
                            ? `${sub.currentMetrics.currentPercentage.toFixed(1)}%`
                            : "—"}{" "}
                          ({sub.currentMetrics.attendedSessions}/
                          {sub.currentMetrics.conductedSessions})
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              sub.scenarios.attendAllRemaining.meetsTarget
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {sub.scenarios.attendAllRemaining.projectedPercentage?.toFixed(
                              1
                            )}
                            %
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              sub.scenarios.missAllRemaining.meetsTarget
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {sub.scenarios.missAllRemaining.projectedPercentage?.toFixed(
                              1
                            )}
                            %
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              sub.scenarios.maintainCurrentRate.meetsTarget
                                ? "text-indigo-600"
                                : "text-rose-600"
                            }`}
                          >
                            {sub.scenarios.maintainCurrentRate.projectedPercentage !==
                            null
                              ? `${sub.scenarios.maintainCurrentRate.projectedPercentage.toFixed(
                                  1
                                )}%`
                              : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Legal/Institutional Disclaimer Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Disclaimer:</strong> {plannerData?.disclaimer || forecastData?.disclaimer}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
