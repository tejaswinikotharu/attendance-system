import { z } from "zod";

export const DayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export type DayOfWeekType = z.infer<typeof DayOfWeekEnum>;

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createTimetableSlotSchema = z
  .object({
    subjectId: z.string().uuid("Invalid subject ID"),
    dayOfWeek: DayOfWeekEnum,
    startTime: z.string().regex(timeRegex, "Start time must be formatted as HH:mm (24-hour)"),
    endTime: z.string().regex(timeRegex, "End time must be formatted as HH:mm (24-hour)"),
    room: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => data.startTime < data.endTime,
    {
      message: "Slot start time must be strictly before end time",
      path: ["endTime"],
    }
  );

export const updateTimetableSlotSchema = z
  .object({
    dayOfWeek: DayOfWeekEnum.optional(),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
    room: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: "Slot start time must be strictly before end time",
      path: ["endTime"],
    }
  );

export const generateSessionsSchema = z.object({
  semesterId: z.string().uuid("Invalid semester ID").optional(),
});

export const importCsvSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  semesterId: z.string().uuid("Invalid semester ID").optional(),
});

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;
export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;
