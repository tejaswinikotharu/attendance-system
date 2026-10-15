import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { api } from "../../api/client";
import { useSemester } from "../../context/SemesterContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { HistoricalImportModal } from "../../components/attendance/HistoricalImportModal";

export const HistoryPage: React.FC = () => {
  const toast = useToast();
  const { selectedSemesterId, selectedSemester } = useSemester();

  // Modals
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState<boolean>(false);

  // Filters state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fetch subjects for filter dropdown
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", selectedSemesterId],
    queryFn: () => api.getSubjects(selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  // Fetch paginated history records
  const {
    data: historyData,
    isLoading,
    error,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: [
      "attendanceHistory",
      selectedSemesterId,
      selectedSubjectId,
      selectedStatus,
      startDate,
      endDate,
      page,
    ],
    queryFn: () =>
      api.getAttendanceHistory({
        semesterId: selectedSemesterId || undefined,
        subjectId: selectedSubjectId || undefined,
        status: selectedStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 15,
      }),
    enabled: !!selectedSemesterId,
  });

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportAttendanceCsvBlob({
        semesterId: selectedSemesterId || undefined,
        subjectId: selectedSubjectId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendwise_attendance_history_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Attendance history exported successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to export attendance CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const records = historyData?.records || [];
  const historicalBaselines = historyData?.historicalBaselines || [];
  const pagination = historyData?.pagination;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Attendance History & Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter, inspect, and export every historical class session record.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsHistoricalModalOpen(true)}
            disabled={!selectedSemesterId}
            className="bg-indigo-50/50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/60"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Import Existing Attendance
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            isLoading={isExporting}
            disabled={!selectedSemesterId || (records.length === 0 && historicalBaselines.length === 0)}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export to CSV
          </Button>
        </div>
      </div>

      {/* Historical Baselines Section (if any baselines exist for this semester) */}
      {historicalBaselines.length > 0 && !startDate && !endDate && (
        <Card
          title={`Imported Historical Baselines (${historicalBaselines.length})`}
          subtitle="Subject aggregate totals imported prior to individual session tracking"
        >
          <div className="mb-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              These counts represent aggregate subject attendance totals established before individual session
              tracking began. Because aggregate imports do not supply individual class dates, they are
              maintained as verified subject baselines and seamlessly integrated with your session calculations.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4 text-center">Attended</th>
                  <th className="py-2.5 px-4 text-center">Conducted</th>
                  <th className="py-2.5 px-4 text-center">Absent</th>
                  <th className="py-2.5 px-4 text-center">Percentage</th>
                  <th className="py-2.5 px-4">Record Type</th>
                  <th className="py-2.5 px-4">Imported At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historicalBaselines.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <div>
                          <p className="font-semibold text-slate-900 leading-tight">
                            {h.subjectName}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {h.subjectCode}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-medium text-emerald-600">
                      {h.present}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-medium text-slate-800">
                      {h.total}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                      {h.absent}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-bold text-indigo-600">
                      {h.percentage.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-block text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                        AGGREGATE BASELINE
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] font-mono">
                      {h.importedAt ? new Date(h.importedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filter Toolbar Card */}
      <Card>
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Subject Filter */}
          <div>
            <label
              htmlFor="filter-subject"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Subject
            </label>
            <select
              id="filter-subject"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label
              htmlFor="filter-status"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Status
            </label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="ATTENDED">Attended</option>
              <option value="ABSENT">Absent</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label
              htmlFor="filter-start-date"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              From Date
            </label>
            <input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="filter-end-date"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              To Date
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {(selectedSubjectId || selectedStatus || startDate || endDate) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedSubjectId("");
                setSelectedStatus("");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </Card>

      {/* History Records Table Card */}
      <Card
        title={`Session Records (${pagination?.totalItems ?? 0})`}
        subtitle="Chronological audit trail of all classes"
      >
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Loading attendance records...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-rose-600 text-xs">
            Failed to load attendance history.
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              No matching attendance records found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your filter criteria or generate sessions in the Timetable page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Session Status</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.sessionId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {r.date}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {r.startTime} – {r.endTime}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: r.subject.color }}
                        />
                        <div>
                          <p className="font-semibold text-slate-900 leading-tight">
                            {r.subject.name}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {r.subject.code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {r.room ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {r.room}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-mono uppercase text-slate-500">
                        {r.sessionStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={r.attendanceStatus} size="sm">
                        {r.attendanceStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {r.note || <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Page {pagination.currentPage} of {pagination.totalPages} (
                  {pagination.totalItems} total records)
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pagination.currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pagination.currentPage >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Historical Attendance Import Modal */}
      {selectedSemesterId && (
        <HistoricalImportModal
          isOpen={isHistoricalModalOpen}
          onClose={() => setIsHistoricalModalOpen(false)}
          onSuccess={() => {
            refetchHistory();
          }}
          semesterId={selectedSemesterId}
          semesterName={selectedSemester?.name}
        />
      )}
    </div>
  );
};
