import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckSquare,
  Calculator,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  HelpCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { useSemester } from "../../context/SemesterContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Button } from "../../components/ui/Button";
import { AttendanceBarChart } from "../../components/charts/AttendanceBarChart";
import { HistoricalImportModal } from "../../components/attendance/HistoricalImportModal";
import { FileSpreadsheet } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const { selectedSemester, selectedSemesterId, isLoading: isSemesterLoading } = useSemester();
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  // 1. Fetch live subject planner & attendance metrics
  const {
    data: plannerData,
    isLoading: isPlannerLoading,
    error: plannerError,
    refetch: refetchPlanner,
  } = useQuery({
    queryKey: ["plannerSubjects", selectedSemesterId],
    queryFn: () => api.getPlannerSubjects(selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  // 2. Fetch today's scheduled classes
  const {
    data: todayData,
    isLoading: isTodayLoading,
    error: todayError,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ["dailyAttendance", "today", selectedSemesterId],
    queryFn: () => api.getDailyAttendance(undefined, selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  if (isSemesterLoading && !selectedSemester) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading semester information...</p>
      </div>
    );
  }

  if (!selectedSemester) {
    return (
      <div className="py-12 px-4 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Semester Found</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          To begin tracking attendance and calculating safe bunks, set up your current semester and timetable.
        </p>
        <Link to="/timetable">
          <Button>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Semester & Timetable
          </Button>
        </Link>
      </div>
    );
  }

  const subjects = Array.isArray(plannerData?.subjects) ? plannerData.subjects : [];

  // Calculate overall semester aggregate attendance
  const totalConducted = subjects.reduce((acc, s) => acc + (s.conductedSessions || 0), 0);
  const totalAttended = subjects.reduce((acc, s) => acc + (s.attendedSessions || 0), 0);
  const overallPercentage =
    totalConducted > 0
      ? Math.round((totalAttended / totalConducted) * 10000) / 100
      : null;

  const targetPercent = selectedSemester.targetPercent || 75;
  const isOverallSafe =
    overallPercentage !== null && overallPercentage >= targetPercent;

  // Identify subjects at risk or below target
  const atRiskSubjects = subjects.filter(
    (s) => (s.conductedSessions || 0) > 0 && !s.isMeetingTarget
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Semester Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              {selectedSemester.name}
            </h1>
            <Badge variant="brand">Active</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Period: {selectedSemester.startDate} to {selectedSemester.endDate} • Target:{" "}
            {selectedSemester.targetPercent}%
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsHistoricalModalOpen(true)}
            className="bg-indigo-50/50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/60"
            title="Import existing attendance totals"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Import Existing Attendance
          </Button>
          <Link to="/attendance">
            <Button size="sm" variant="outline">
              <CheckSquare className="w-4 h-4 mr-1.5" />
              Mark Attendance
            </Button>
          </Link>
          <Link to="/planner">
            <Button size="sm" variant="outline">
              <Calculator className="w-4 h-4 mr-1.5" />
              Bunk Planner
            </Button>
          </Link>
          <Link to="/timetable">
            <Button size="sm">
              <Calendar className="w-4 h-4 mr-1.5" />
              Timetable
            </Button>
          </Link>
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Overall Attendance Card */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overall Attendance
            </span>
            {overallPercentage !== null ? (
              <Badge variant={isOverallSafe ? "SAFE" : "CRITICAL"}>
                {isOverallSafe ? "On Track" : "Below Target"}
              </Badge>
            ) : (
              <Badge variant="NO_DATA">No Data</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {overallPercentage !== null ? `${overallPercentage.toFixed(1)}%` : "—"}
            </span>
            <span className="text-xs text-slate-500">
              {totalConducted > 0
                ? `(${totalAttended}/${totalConducted} classes attended)`
                : "0 classes evaluated"}
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar
              percentage={overallPercentage}
              target={targetPercent}
              size="sm"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 inline shrink-0" />
            Aggregate = Total Attended ÷ Total Conducted across all subjects.
          </p>
        </Card>

        {/* Safe Bunks / Status */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Safe Bunk Cushion
            </span>
            <Calculator className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {subjects.reduce((acc, s) => acc + (s.safeBunks || 0), 0)}
            </span>
            <span className="text-xs text-slate-500">total safe bunks available</span>
          </div>
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            {atRiskSubjects.length === 0
              ? "All active subjects currently satisfy your attendance target!"
              : `${atRiskSubjects.length} subject(s) are below target and require attendance recovery.`}
          </p>
        </Card>

        {/* Today's Classes Summary */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today&apos;s Schedule
            </span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {todayData?.totalSessions || 0}
            </span>
            <span className="text-xs text-slate-500">
              classes scheduled today
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-emerald-600 font-medium">
              {todayData?.attendedCount || 0} Attended
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-amber-600 font-medium">
              {todayData?.pendingCount || 0} Pending
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-rose-600 font-medium">
              {todayData?.absentCount || 0} Absent
            </span>
          </div>
        </Card>
      </div>

      {/* Error Alert if planner metrics failed to load */}
      {plannerError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-rose-900">
                Failed to load attendance metrics
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                {(plannerError as any)?.message || "A network or server error occurred while retrieving attendance data."}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="bg-white shrink-0" onClick={() => refetchPlanner()}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Warning Alert if any subjects are in deficit */}
      {!plannerError && atRiskSubjects.length > 0 && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Attendance Deficit Detected in {atRiskSubjects.length} Subject(s)
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {atRiskSubjects.map((s) => s.subjectName).join(", ")} currently below {targetPercent}%.
              </p>
            </div>
          </div>
          <Link to="/planner">
            <Button size="sm" variant="outline" className="bg-white shrink-0">
              View Recovery Plan
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Main Grid: Visual Analytics & Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Visual Comparison Chart */}
        <div className="lg:col-span-2">
          <Card
            title="Subject Attendance Comparison"
            subtitle="Actual evaluated attendance vs target threshold"
          >
            {isPlannerLoading ? (
              <div className="h-72 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : plannerError ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-rose-200">
                <p className="text-xs text-rose-600 font-medium">Failed to load chart metrics</p>
                <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => refetchPlanner()}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : (
              <AttendanceBarChart
                subjects={subjects}
                targetPercent={targetPercent}
              />
            )}
          </Card>
        </div>

        {/* Today's Classes List Card */}
        <div>
          <Card
            title="Today's Classes"
            subtitle={todayData?.date || "Today"}
            headerAction={
              <Link
                to="/attendance"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                View Daily
              </Link>
            }
          >
            {isTodayLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />
              </div>
            ) : todayError ? (
              <div className="py-8 text-center text-slate-500">
                <p className="text-xs text-rose-600 font-medium">Failed to load today&apos;s classes</p>
                <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => refetchToday()}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : !Array.isArray(todayData?.sessions) || todayData.sessions.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs font-medium">No classes scheduled today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayData.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: session.subject.color }}
                        />
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {session.subject.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {session.startTime} - {session.endTime}
                        {session.room ? ` • ${session.room}` : ""}
                      </p>
                    </div>

                    <Badge variant={session.attendanceStatus} size="sm">
                      {session.attendanceStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Subject-Wise Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Subject Attendance Overview
          </h2>
          <Link
            to="/timetable"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Manage Subjects & Timetable →
          </Link>
        </div>

        {isPlannerLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 bg-white rounded-xl border border-slate-200 animate-pulse"
              />
            ))}
          </div>
        ) : plannerError ? (
          <div className="p-8 text-center bg-white rounded-xl border border-rose-200">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-rose-900">
              Unable to load subject attendance overview
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {(plannerError as any)?.message || "Please check your network connection and try again."}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetchPlanner()}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
            <p className="text-sm font-medium text-slate-600">
              No subjects registered in this semester
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Add your subjects or import a timetable CSV to start tracking.
            </p>
            <Link to="/timetable">
              <Button size="sm">Add Subjects</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjects.map((sub) => {
              const hasClasses = sub.conductedSessions > 0;
              return (
                <Card key={sub.subjectId} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-md shrink-0"
                          style={{ backgroundColor: sub.color }}
                        />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                            {sub.subjectName}
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400 uppercase">
                            {sub.subjectCode}
                          </span>
                          {sub.historicalBaseline && (
                            <span
                              className="ml-2 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 px-1.5 py-0.5 rounded"
                              title={`Imported Historical Baseline: ${sub.historicalBaseline.present}/${sub.historicalBaseline.total} classes attended`}
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

                    {/* Attendance percentage and conducted count */}
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-900">
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

                    {/* Recommendation pill */}
                    <div className="mt-3.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <p className="font-semibold text-slate-800 text-[11px] flex items-center gap-1.5">
                        {sub.isMeetingTarget ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        {sub.headline}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {sub.mathematicalExplanation}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Safe Bunks:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {sub.safeBunks}
                      </strong>
                    </span>
                    <span>
                      Remaining:{" "}
                      <strong className="text-slate-800 font-semibold">
                        {sub.remainingSessions}
                      </strong>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Attendance Import Modal */}
      {selectedSemesterId && (
        <HistoricalImportModal
          isOpen={isHistoricalModalOpen}
          onClose={() => setIsHistoricalModalOpen(false)}
          onSuccess={() => {
            refetchPlanner();
            refetchToday();
          }}
          semesterId={selectedSemesterId}
          semesterName={selectedSemester?.name}
        />
      )}
    </div>
  );
};
