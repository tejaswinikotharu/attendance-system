import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import { DayOfWeek, Subject, TimetableSlot } from "../../types";

const slotSchema = z
  .object({
    subjectId: z.string().min(1, "Please select a subject"),
    dayOfWeek: z.enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be HH:mm"),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be HH:mm"),
    room: z.string().optional().nullable(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  });

type SlotFormValues = z.infer<typeof slotSchema>;

interface SlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subjects: Subject[];
  slotToEdit?: TimetableSlot | null;
  defaultDay?: DayOfWeek;
}

const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const SlotModal: React.FC<SlotModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  subjects,
  slotToEdit,
  defaultDay = "MONDAY",
}) => {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      subjectId: "",
      dayOfWeek: defaultDay,
      startTime: "09:00",
      endTime: "10:00",
      room: "",
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        subjectId: slotToEdit?.subjectId || subjects[0]?.id || "",
        dayOfWeek: slotToEdit?.dayOfWeek || defaultDay,
        startTime: slotToEdit?.startTime || "09:00",
        endTime: slotToEdit?.endTime || "10:00",
        room: slotToEdit?.room || "",
      });
    }
  }, [isOpen, slotToEdit, defaultDay, subjects, reset]);

  const onSubmit = async (values: SlotFormValues) => {
    try {
      if (slotToEdit) {
        await api.updateSlot(slotToEdit.id, values);
        toast.success("Slot updated successfully!");
      } else {
        await api.createSlot(values);
        toast.success("Timetable slot created!");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save timetable slot");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={slotToEdit ? "Edit Timetable Slot" : "Add Timetable Slot"}
      description="Schedule a recurring weekly lecture, tutorial, or lab slot."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Subject select */}
        <div>
          <label
            htmlFor="slot-subject"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Subject
          </label>
          <select
            id="slot-subject"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            {...register("subjectId")}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          {errors.subjectId && (
            <p className="text-xs text-rose-600 mt-1">{errors.subjectId.message}</p>
          )}
        </div>

        {/* Day of Week select */}
        <div>
          <label
            htmlFor="slot-day"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Day of Week
          </label>
          <select
            id="slot-day"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            {...register("dayOfWeek")}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time (HH:mm)"
            type="time"
            error={errors.startTime?.message}
            {...register("startTime")}
          />
          <Input
            label="End Time (HH:mm)"
            type="time"
            error={errors.endTime?.message}
            {...register("endTime")}
          />
        </div>

        <Input
          label="Room / Location (Optional)"
          placeholder="e.g. Hall 102"
          {...register("room")}
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isSubmitting}>
            {slotToEdit ? "Update Slot" : "Add Slot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
