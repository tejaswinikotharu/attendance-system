import { z } from "zod";

export const createSemesterSchema = z
  .object({
    name: z.string().min(1, "Semester name is required").trim(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be formatted as YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be formatted as YYYY-MM-DD"),
    targetPercent: z
      .number()
      .int("Target attendance must be an integer")
      .min(1, "Target attendance must be at least 1%")
      .max(99, "Target attendance must be at most 99%")
      .default(75),
    isCurrent: z.boolean().default(true),
  })
  .refine(
    (data) => new Date(data.startDate) < new Date(data.endDate),
    {
      message: "Semester start date must be strictly before end date",
      path: ["endDate"],
    }
  );

export const updateSemesterSchema = z.object({
  name: z.string().min(1).trim().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  targetPercent: z.number().int().min(1).max(99).optional(),
  isCurrent: z.boolean().optional(),
});

export type CreateSemesterInput = z.infer<typeof createSemesterSchema>;
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;
