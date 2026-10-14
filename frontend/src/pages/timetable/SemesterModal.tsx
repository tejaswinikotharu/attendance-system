import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import { Semester } from "../../types";

const semesterSchema = z
  .object({
    name: z.string().min(1, "Semester name is required").trim(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
    targetPercent: z
      .number()
      .int()
      .min(1, "Target must be at least 1%")
      .max(99, "Target must be at most 99%"),
    isCurrent: z.boolean(),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "Start date must be strictly before end date",
    path: ["endDate"],
  });

type SemesterFormValues = z.infer<typeof semesterSchema>;

interface SemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (semester: Semester) => void;
  semesterToEdit?: Semester | null;
}

export const SemesterModal: React.FC<SemesterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  semesterToEdit,
}) => {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: {
      name: semesterToEdit?.name || "Fall 2026",
      startDate: semesterToEdit?.startDate?.slice(0, 10) || "2026-08-01",
      endDate: semesterToEdit?.endDate?.slice(0, 10) || "2026-12-15",
      targetPercent: semesterToEdit?.targetPercent || 75,
      isCurrent: semesterToEdit?.isCurrent ?? true,
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: semesterToEdit?.name || "",
        startDate: semesterToEdit?.startDate?.slice(0, 10) || "",
        endDate: semesterToEdit?.endDate?.slice(0, 10) || "",
        targetPercent: semesterToEdit?.targetPercent || 75,
        isCurrent: semesterToEdit?.isCurrent ?? true,
      });
    }
  }, [isOpen, semesterToEdit, reset]);

  const onSubmit = async (values: SemesterFormValues) => {
    try {
      if (semesterToEdit) {
        const updated = await api.updateSemester(semesterToEdit.id, values);
        toast.success("Semester updated successfully!");
        onSuccess(updated);
      } else {
        const created = await api.createSemester(values);
        toast.success("Semester created successfully!");
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save semester");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={semesterToEdit ? "Edit Semester" : "Create New Semester"}
      description="Define semester boundaries and global target attendance."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Semester Name"
          placeholder="e.g. Semester 5 (Fall 2026)"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            error={errors.startDate?.message}
            {...register("startDate")}
          />
          <Input
            label="End Date"
            type="date"
            error={errors.endDate?.message}
            {...register("endDate")}
          />
        </div>

        <Input
          label="Target Attendance (%)"
          type="number"
          min={1}
          max={99}
          error={errors.targetPercent?.message}
          {...register("targetPercent", { valueAsNumber: true })}
        />

        <div className="flex items-center gap-2 pt-1">
          <input
            id="isCurrent"
            type="checkbox"
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            {...register("isCurrent")}
          />
          <label htmlFor="isCurrent" className="text-xs text-slate-700 font-medium">
            Set as active current semester
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isSubmitting}>
            {semesterToEdit ? "Save Changes" : "Create Semester"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
