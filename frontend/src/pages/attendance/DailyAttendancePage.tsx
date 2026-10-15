import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Ban,
  AlertCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { useSemester } from "../../context/SemesterContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { DailySession } from "../../types";
import { HistoricalImportModal } from "../../components/attendance/HistoricalImportModal";
import { FileSpreadsheet } from "lucide-react";

export const DailyAttendancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { selectedSemesterId } = useSemester();

  // Selected date in YYYY-MM-DD
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState<boolean>(false);

  const {
    data: dailyData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["dailyAttendance", selectedDate, selectedSemesterId],
    queryFn: () =>
      api.getDailyAttendance(selectedDate, selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  const markMutation = useMutation({
    mutationFn: async ({
      sessionId,
      status,
      isCorrection,
    }: {
      sessionId: string;
      status: "ATTENDED" | "ABSENT";
      isCorrection: boolean;
    }) => {
      setActiveSessionId(sessionId);
      if (isCorrection) {
        return await api.updateAttendance(sessionId, { status });
      }
      return await api.markAttendance({ sessionId, status });
    },
    onSuccess: (data, variables) => {
      toast.success(
        `Marked as ${variables.status} for ${data?.subjectSummary?.subjectName || "class"}`
      );
      // Invalidate relevant query caches
      queryClient.invalidateQueries({ queryKey: ["dailyAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["plannerSubjects"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record attendance");
    },
    onSettled: () => {
      setActiveSessionId(null);
    },
  });

  const changeDateBy = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const sessions = dailyData?.sessions || [];

  return (
    <div className="space-y-6">
      {/* Header bar with Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Daily Attendance Marking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record, verify, and correct your attendance for scheduled classes.
          </p>
        </div>

        {/* Date Selector Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDateBy(-1)}
            aria-label="Previous day"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => changeDateBy(1)}
            aria-label="Next day"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {selectedDate !== todayStr && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedDate(todayStr)}
            >
              Today
            </Button>
          )}

          <button
            onClick={() => refetch()}
            aria-label="Refresh daily schedule"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefetching ? "animate-spin text-indigo-600" : ""}`}
            />
          </button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsHistoricalModalOpen(true)}
            disabled={!selectedSemesterId}
            className="bg-indigo-50/50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/60 ml-1"
            title="Import past attendance totals"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Import Existing Attendance
          </Button>
        </div>
      </div>

      {/* Daily Summary Statistics */}
      {dailyData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Classes
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {dailyData.totalSessions}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Attended
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {dailyData.attendedCount}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Pending
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {dailyData.pendingCount}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Absent
            </p>
            <p className="text-2xl font-bold text-rose-700 mt-1">
              {dailyData.absentCount}
            </p>
          </div>
        </div>
      )}

      {/* Scheduled Classes List */}
      <Card
        title={`Scheduled Classes (${sessions.length})`}
        subtitle={`Schedule for ${selectedDate}`}
      >
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            <p className="text-xs text-slate-400 mt-3">Loading daily sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              No classes scheduled for {selectedDate}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Make sure class sessions were generated from the Timetable page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: DailySession) => {
              const isProcessing =
                markMutation.isPending && activeSessionId === session.id;
              const isCancelled = session.sessionStatus === "CANCELLED";
              const isMarked =
                session.attendanceStatus === "ATTENDED" ||
                session.attendanceStatus === "ABSENT";

              return (
                <div
                  key={session.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCancelled
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : session.attendanceStatus === "ATTENDED"
                      ? "bg-emerald-50/40 border-emerald-200"
                      : session.attendanceStatus === "ABSENT"
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-white border-slate-200 shadow-2xs"
                  }`}
                >
                  {/* Left: Subject Info & Timing */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className="w-2 h-12 rounded-full shrink-0"
                      style={{ backgroundColor: session.subject.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {session.subject.name}
                        </h3>
                        <span className="text-[11px] font-mono text-slate-500 uppercase">
                          ({session.subject.code})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {session.startTime} – {session.endTime}
                        </span>
                        {session.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {session.room}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          Status: {session.sessionStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Attendance Action Buttons & Badge */}
                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <Badge variant={session.attendanceStatus}>
                      {session.attendanceStatus}
                    </Badge>

                    {isCancelled ? (
                      <span className="text-xs text-slate-400 italic flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5" />
                        Cancelled
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* Attended Button */}
                        <Button
                          size="sm"
                          variant={
                            session.attendanceStatus === "ATTENDED"
                              ? "primary"
                              : "outline"
                          }
                          disabled={isProcessing}
                          onClick={() =>
                            markMutation.mutate({
                              sessionId: session.id,
                              status: "ATTENDED",
                              isCorrection: isMarked,
                            })
                          }
                          className={
                            session.attendanceStatus === "ATTENDED"
                              ? "bg-emerald-600 hover:bg-emerald-700 border-transparent text-white"
                              : "hover:border-emerald-500 hover:text-emerald-600"
                          }
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Attended
                        </Button>

                        {/* Absent Button */}
                        <Button
                          size="sm"
                          variant={
                            session.attendanceStatus === "ABSENT"
                              ? "danger"
                              : "outline"
                          }
                          disabled={isProcessing}
                          onClick={() =>
                            markMutation.mutate({
                              sessionId: session.id,
                              status: "ABSENT",
                              isCorrection: isMarked,
                            })
                          }
                          className={
                            session.attendanceStatus === "ABSENT"
                              ? "bg-rose-600 hover:bg-rose-700 text-white"
                              : "hover:border-rose-500 hover:text-rose-600"
                          }
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Absent
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Information Tip */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong>Attendance Tracking Rules:</strong> Unmarked sessions stay{" "}
          <span className="font-semibold text-slate-700">PENDING</span> and do not count toward conducted statistics until explicitly marked. You can correct any recorded response anytime. Cancelled classes are excluded from conducted totals.
        </p>
      </div>

      {/* Historical Attendance Import Modal */}
      {selectedSemesterId && (
        <HistoricalImportModal
          isOpen={isHistoricalModalOpen}
          onClose={() => setIsHistoricalModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["dailyAttendance"] });
            queryClient.invalidateQueries({ queryKey: ["plannerSubjects"] });
            queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
          }}
          semesterId={selectedSemesterId}
        />
      )}
    </div>
  );
};
