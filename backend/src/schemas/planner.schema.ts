import { z } from "zod";

export const plannerQuerySchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
});

export const simulateSessionItemSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  action: z.enum(["ATTEND", "MISS"]),
});

export const simulateAttendanceSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
  subjectId: z.string().uuid("Invalid subject ID"),
  simulatedSessions: z
    .array(simulateSessionItemSchema)
    .min(1, "At least one future session must be selected to simulate")
    .max(50, "Cannot simulate more than 50 sessions in a single scenario"),
});

export const forecastQuerySchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
  customAttendanceRate: z
    .coerce
    .number()
    .int("Custom rate must be an integer percentage")
    .min(0, "Custom rate cannot be negative")
    .max(100, "Custom rate cannot exceed 100%")
    .optional(),
});

export type PlannerQuery = z.infer<typeof plannerQuerySchema>;
export type SimulateSessionItem = z.infer<typeof simulateSessionItemSchema>;
export type SimulateAttendanceInput = z.infer<typeof simulateAttendanceSchema>;
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
