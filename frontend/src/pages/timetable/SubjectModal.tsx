import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import { Subject } from "../../types";

const subjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(100),
  code: z
    .string()
    .min(1, "Subject code is required")
    .max(20),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex code (e.g. #2563EB)"),
  targetPercent: z
    .number()
    .int()
    .min(1)
    .max(99)
    .optional()
    .nullable(),
  professor: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  semesterId: string;
  subjectToEdit?: Subject | null;
}

const PRESET_COLORS = [
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#059669", // Emerald
  "#D97706", // Amber
  "#DC2626", // Red
  "#0891B2", // Cyan
  "#4F46E5", // Indigo
  "#DB2777", // Pink
];

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  semesterId,
  subjectToEdit,
}) => {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: "",
      code: "",
      color: "#2563EB",
      targetPercent: null,
      professor: "",
      room: "",
    },
  });

  const selectedColor = watch("color");

  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: subjectToEdit?.name || "",
        code: subjectToEdit?.code || "",
        color: subjectToEdit?.color || "#2563EB",
        targetPercent: subjectToEdit?.targetPercent ?? null,
        professor: subjectToEdit?.professor || "",
        room: subjectToEdit?.room || "",
      });
    }
  }, [isOpen, subjectToEdit, reset]);

  const onSubmit = async (values: SubjectFormValues) => {
    try {
      const payload = {
        name: values.name,
        code: values.code,
        color: values.color,
        targetPercent: values.targetPercent ? Number(values.targetPercent) : null,
        professor: values.professor || null,
        room: values.room || null,
      };

      if (subjectToEdit) {
        await api.updateSubject(subjectToEdit.id, payload);
        toast.success("Subject updated successfully!");
      } else {
        await api.createSubject({
          ...payload,
          semesterId,
        });
        toast.success("Subject added successfully!");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save subject");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={subjectToEdit ? "Edit Subject" : "Add Subject"}
      description="Add course details, color tag, and optional target attendance override."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Subject Name"
          placeholder="e.g. Operating Systems"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Course Code"
            placeholder="e.g. CS301"
            error={errors.code?.message}
            {...register("code")}
          />
          <Input
            label="Target % (Leave blank for default)"
            type="number"
            min={1}
            max={99}
            placeholder="Default"
            error={errors.targetPercent ? "Must be 1-99" : undefined}
            {...register("targetPercent", {
              setValueAs: (v) => (v === "" || v === undefined || isNaN(v) ? null : Number(v)),
            })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Professor (Optional)"
            placeholder="e.g. Dr. Turing"
            {...register("professor")}
          />
          <Input
            label="Default Room (Optional)"
            placeholder="e.g. Lab 4B"
            {...register("room")}
          />
        </div>

        {/* Color Palette Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Subject Color Tag
          </label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue("color", c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  selectedColor === c ? "border-slate-900 scale-110" : "border-white"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          {errors.color && (
            <p className="text-xs text-rose-600 mt-1">{errors.color.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isSubmitting}>
            {subjectToEdit ? "Update Subject" : "Create Subject"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
