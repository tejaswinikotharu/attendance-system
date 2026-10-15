import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Plus,
  FileSpreadsheet,
  Zap,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { useSemester } from "../../context/SemesterContext";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { DayOfWeek, Subject, TimetableSlot } from "../../types";
import { SemesterModal } from "./SemesterModal";
import { SubjectModal } from "./SubjectModal";
import { SlotModal } from "./SlotModal";
import { CsvImportModal } from "./CsvImportModal";
import { HistoricalImportModal } from "../../components/attendance/HistoricalImportModal";

const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const TimetablePage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    selectedSemester,
    selectedSemesterId,
    refreshSemesters,
  } = useSemester();

  // Modals state
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  // Edit / Delete tracking
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [slotToEdit, setSlotToEdit] = useState<TimetableSlot | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "subject" | "slot";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Active day filter for mobile / compact view
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("MONDAY");

  // Fetch subjects for this semester
  const { data: subjects = [], isLoading: isSubjectsLoading } = useQuery({
    queryKey: ["subjects", selectedSemesterId],
    queryFn: () => api.getSubjects(selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  // Fetch timetable slots for this semester
  const { data: slots = [], isLoading: isSlotsLoading } = useQuery({
    queryKey: ["timetableSlots", selectedSemesterId],
    queryFn: () => api.getSlots(selectedSemesterId || undefined),
    enabled: !!selectedSemesterId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["subjects"] });
    queryClient.invalidateQueries({ queryKey: ["timetableSlots"] });
    queryClient.invalidateQueries({ queryKey: ["plannerSubjects"] });
    queryClient.invalidateQueries({ queryKey: ["dailyAttendance"] });
    queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
  };

  const handleGenerateSessions = async () => {
    if (!selectedSemesterId) return;
    setIsGenerating(true);
    try {
      const res = await api.generateSessions(selectedSemesterId);
      toast.success(
        res.message || `Generated ${res.count} class sessions!`,
        "Sessions Generated"
      );
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate class sessions");
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === "subject") {
        await api.deleteSubject(deleteConfirm.id);
        toast.success(`Subject "${deleteConfirm.name}" deleted.`);
      } else {
        await api.deleteSlot(deleteConfirm.id);
        toast.success("Timetable slot removed.");
      }
      invalidateAll();
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Timetable & Semester Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your academic calendar, course subjects, weekly slots, and scheduled sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsHistoricalModalOpen(true)}
            disabled={!selectedSemesterId}
            className="bg-indigo-50/50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/60"
            title="Import subject-wise attendance totals to set up immediate dashboard baseline"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Import Existing Attendance
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCsvModalOpen(true)}
            disabled={!selectedSemesterId}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Import CSV Timetable
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateSessions}
            isLoading={isGenerating}
            disabled={!selectedSemesterId || slots.length === 0}
            title="Generate dated class sessions across semester schedule"
          >
            <Zap className="w-4 h-4 mr-1.5 text-amber-500" />
            Generate Sessions
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSemesterModalOpen(true)}
          >
            <CalendarIcon className="w-4 h-4 mr-1.5" />
            New Semester
          </Button>
        </div>
      </div>

      {!selectedSemester ? (
        <Card className="py-12 text-center max-w-md mx-auto">
          <CalendarIcon className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">No Semester Configured</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Create your first semester to begin defining your timetable and tracking classes.
          </p>
          <Button size="sm" onClick={() => setIsSemesterModalOpen(true)}>
            Create Semester
          </Button>
        </Card>
      ) : (
        <>
          {/* Semester Details Banner */}
          <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-700">
              <span>
                <strong>Semester:</strong> {selectedSemester.name}
              </span>
              <span>
                <strong>Duration:</strong> {selectedSemester.startDate} to{" "}
                {selectedSemester.endDate}
              </span>
              <span>
                <strong>Default Target:</strong> {selectedSemester.targetPercent}%
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSemesterModalOpen(true)}
              className="bg-white shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              Edit Semester
            </Button>
          </div>

          {/* Subjects Management Section */}
          <Card
            title={`Registered Subjects (${subjects.length})`}
            subtitle="Courses enrolled in the current active semester"
            headerAction={
              <Button
                size="sm"
                onClick={() => {
                  setSubjectToEdit(null);
                  setIsSubjectModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Subject
              </Button>
            }
          >
            {isSubjectsLoading ? (
              <div className="py-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />
              </div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <p className="text-xs">No subjects added yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3.5 h-9 rounded-md shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {sub.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono font-semibold uppercase">
                            {sub.code}
                          </span>
                          {sub.targetPercent && (
                            <span>• Target: {sub.targetPercent}%</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setSubjectToEdit(sub);
                          setIsSubjectModalOpen(true);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        aria-label="Edit subject"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            type: "subject",
                            id: sub.id,
                            name: sub.name,
                          })
                        }
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        aria-label="Delete subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Weekly Timetable Schedule Section */}
          <Card
            title={`Weekly Timetable (${slots.length} Slots)`}
            subtitle="Recurring weekly timetable schedule"
            headerAction={
              <Button
                size="sm"
                onClick={() => {
                  setSlotToEdit(null);
                  setIsSlotModalOpen(true);
                }}
                disabled={subjects.length === 0}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Class Slot
              </Button>
            }
          >
            {/* Day Selector Tabs */}
            <div className="flex items-center gap-1 pb-3 mb-4 overflow-x-auto border-b border-slate-100">
              {DAYS_OF_WEEK.map((day) => {
                const daySlotCount = slots.filter((s) => s.dayOfWeek === day).length;
                const isSelected = selectedDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{day.slice(0, 3)}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-indigo-700 text-indigo-100"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {daySlotCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Timetable slots for selected day */}
            {isSlotsLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />
              </div>
            ) : slots.filter((s) => s.dayOfWeek === selectedDay).length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs font-medium">No classes scheduled on {selectedDay}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click &quot;Add Class Slot&quot; to assign a subject to this day.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {slots
                  .filter((s) => s.dayOfWeek === selectedDay)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((slot) => {
                    const subject = subjects.find((sub) => sub.id === slot.subjectId);
                    return (
                      <div
                        key={slot.id}
                        className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-1.5 h-10 rounded-full shrink-0"
                            style={{ backgroundColor: subject?.color || "#2563EB" }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {subject?.name || "Unknown Subject"}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span className="flex items-center gap-1 font-medium text-slate-700">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {slot.startTime} – {slot.endTime}
                              </span>
                              {slot.room && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {slot.room}
                                </span>
                              )}
                              <span className="font-mono uppercase text-slate-400">
                                {subject?.code}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setSlotToEdit(slot);
                              setIsSlotModalOpen(true);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            aria-label="Edit slot"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                type: "slot",
                                id: slot.id,
                                name: `${subject?.name || "Class"} (${slot.startTime}-${slot.endTime})`,
                              })
                            }
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            aria-label="Delete slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Confirmation Dialog for Destructive Actions */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Deletion"
        description="Are you sure you want to proceed with this destructive action?"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-800 leading-relaxed">
              Deleting <strong>&quot;{deleteConfirm?.name}&quot;</strong> will permanently remove it
              {deleteConfirm?.type === "subject"
                ? " along with its associated timetable slots and class sessions."
                : "."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modals */}
      <SemesterModal
        isOpen={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
        onSuccess={() => {
          refreshSemesters();
          invalidateAll();
        }}
        semesterToEdit={selectedSemester}
      />

      {selectedSemesterId && (
        <>
          <SubjectModal
            isOpen={isSubjectModalOpen}
            onClose={() => setIsSubjectModalOpen(false)}
            onSuccess={invalidateAll}
            semesterId={selectedSemesterId}
            subjectToEdit={subjectToEdit}
          />

          <SlotModal
            isOpen={isSlotModalOpen}
            onClose={() => setIsSlotModalOpen(false)}
            onSuccess={invalidateAll}
            subjects={subjects}
            slotToEdit={slotToEdit}
            defaultDay={selectedDay}
          />

          <CsvImportModal
            isOpen={isCsvModalOpen}
            onClose={() => setIsCsvModalOpen(false)}
            onSuccess={invalidateAll}
            semesterId={selectedSemesterId}
          />

          <HistoricalImportModal
            isOpen={isHistoricalModalOpen}
            onClose={() => setIsHistoricalModalOpen(false)}
            onSuccess={invalidateAll}
            semesterId={selectedSemesterId}
            semesterName={selectedSemester?.name}
          />
        </>
      )}
    </div>
  );
};
