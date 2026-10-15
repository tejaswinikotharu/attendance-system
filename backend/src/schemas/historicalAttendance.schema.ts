import { z } from "zod";

export const historicalAttendanceRowSchema = z
  .object({
    subjectCode: z
      .string()
      .trim()
      .min(1, "Subject code cannot be empty")
      .max(50, "Subject code cannot exceed 50 characters"),
    subjectName: z
      .string()
      .trim()
      .min(1, "Subject name cannot be empty")
      .max(150, "Subject name cannot exceed 150 characters"),
    present: z.coerce
      .number()
      .int("Present count must be an integer")
      .min(0, "Present count cannot be negative"),
    total: z.coerce
      .number()
      .int("Total conducted count must be an integer")
      .min(1, "Total conducted classes must be greater than zero for percentage-based imports"),
  })
  .refine((data) => data.present <= data.total, {
    message: "Present count cannot exceed total conducted classes",
    path: ["present"],
  });

export const historicalImportPreviewSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
  rawCsv: z.string().optional(),
  items: z
    .array(
      z.object({
        subjectCode: z.any().optional(),
        subjectName: z.any().optional(),
        present: z.any().optional(),
        total: z.any().optional(),
      })
    )
    .optional(),
});

export const historicalImportCommitSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
  items: z
    .array(historicalAttendanceRowSchema)
    .min(1, "At least one subject attendance row is required for import"),
  overwriteExisting: z.boolean().optional().default(false),
});

export type HistoricalAttendanceRowInput = z.infer<typeof historicalAttendanceRowSchema>;
export type HistoricalImportPreviewInput = z.infer<typeof historicalImportPreviewSchema>;
export type HistoricalImportCommitInput = z.infer<typeof historicalImportCommitSchema>;
