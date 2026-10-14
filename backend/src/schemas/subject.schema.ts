import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").max(100).trim(),
  code: z
    .string()
    .min(1, "Subject code is required")
    .max(20)
    .trim()
    .transform((val) => val.toUpperCase()),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid 6-character hex code (e.g. #2563EB)")
    .default("#2563EB"),
  targetPercent: z
    .number()
    .int("Target attendance must be an integer")
    .min(1, "Target attendance must be at least 1%")
    .max(99, "Target attendance must be at most 99%")
    .optional()
    .nullable(),
  professor: z.string().trim().optional().nullable(),
  room: z.string().trim().optional().nullable(),
  semesterId: z.string().uuid("Invalid semester ID").optional(),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  code: z
    .string()
    .min(1)
    .max(20)
    .trim()
    .transform((val) => val.toUpperCase())
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  targetPercent: z
    .number()
    .int()
    .min(1)
    .max(99)
    .optional()
    .nullable(),
  professor: z.string().trim().optional().nullable(),
  room: z.string().trim().optional().nullable(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
