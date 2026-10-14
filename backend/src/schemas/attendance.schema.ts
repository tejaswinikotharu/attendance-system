import { z } from "zod";

export const markAttendanceSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  status: z.enum(["ATTENDED", "ABSENT"]),
  note: z.string().max(500, "Note cannot exceed 500 characters").trim().optional().nullable(),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(["ATTENDED", "ABSENT"]).optional(),
  note: z.string().max(500, "Note cannot exceed 500 characters").trim().optional().nullable(),
});

export const dailyAttendanceQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD")
    .optional(),
  semesterId: z.string().uuid("Invalid semester ID").optional(),
});

export const attendanceHistoryQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  subjectId: z.string().uuid().optional(),
  status: z.enum(["ATTENDED", "ABSENT", "PENDING", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  semesterId: z.string().uuid().optional(),
});

export const exportAttendanceCsvQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subjectId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type DailyAttendanceQuery = z.infer<typeof dailyAttendanceQuerySchema>;
export type AttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;
export type ExportAttendanceCsvQuery = z.infer<typeof exportAttendanceCsvQuerySchema>;
