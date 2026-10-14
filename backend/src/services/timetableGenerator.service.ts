import { DayOfWeek } from "@prisma/client";
import { AppError } from "../middleware/error.middleware.js";
import { getAuthorizedSemester } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";
import { getCurrentSemester } from "./semester.service.js";

const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export interface GenerationSummary {
  semesterId: string;
  semesterName: string;
  startDate: string;
  endDate: string;
  generatedSessionsCount: number;
  preservedSessionsCount: number;
  holidaysSkippedCount: number;
  totalSessionsCount: number;
}

/**
 * Normalizes a Date object to YYYY-MM-DD string format using UTC.
 */
export function formatDateToIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Idempotently generates dated class sessions across the semester timeline.
 * Strict guarantees:
 * 1. Generates sessions only on configured weekdays.
 * 2. Omits dates recorded in the Holiday table.
 * 3. Enforces unique session key [semesterId, subjectId, date, startTime].
 * 4. Running multiple times is completely idempotent (0 duplicate sessions created).
 * 5. Historical attendance records are permanently preserved and never overwritten.
 */
export const generateSemesterSessions = async (
  userId: string,
  semesterId?: string
): Promise<GenerationSummary> => {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (!current) {
      const error: AppError = new Error(
        "No active semester found. Please create a semester first before generating timetable sessions."
      );
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = current.id;
  }

  const semester = await getAuthorizedSemester(targetSemesterId, userId);

  // 1. Fetch all timetable slots for subjects in this semester
  const slots = await prisma.timetableSlot.findMany({
    where: {
      subject: {
        semesterId: targetSemesterId,
      },
    },
    include: {
      subject: true,
    },
  });

  if (slots.length === 0) {
    const error: AppError = new Error(
      "No timetable slots configured for this semester. Add weekly class slots before generating sessions."
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch all recorded holidays for this semester
  const holidays = await prisma.holiday.findMany({
    where: {
      semesterId: targetSemesterId,
    },
  });

  const holidayDateSet = new Set(
    holidays.map((h) => formatDateToIsoDay(h.date))
  );

  // 3. Fetch all existing sessions with attendance records to preserve historical data
  const existingSessions = await prisma.classSession.findMany({
    where: {
      semesterId: targetSemesterId,
    },
    include: {
      attendanceRecord: true,
    },
  });

  const sessionKey = (subjectId: string, dayStr: string, startTime: string) =>
    `${subjectId}_${dayStr}_${startTime}`;

  const existingSessionMap = new Map(
    existingSessions.map((s) => [
      sessionKey(s.subjectId, formatDateToIsoDay(s.date), s.startTime),
      s,
    ])
  );

  const sessionsToCreate: {
    semesterId: string;
    subjectId: string;
    date: Date;
    startTime: string;
    endTime: string;
    room: string | null;
    status: "SCHEDULED";
  }[] = [];

  let preservedSessionsCount = 0;
  let holidaysSkippedCount = 0;

  // 4. Iterate day by day from startDate to endDate
  const currentCursor = new Date(semester.startDate);
  // Normalize cursor to UTC midnight
  currentCursor.setUTCHours(0, 0, 0, 0);

  const endCursor = new Date(semester.endDate);
  endCursor.setUTCHours(0, 0, 0, 0);

  while (currentCursor <= endCursor) {
    const dayStr = formatDateToIsoDay(currentCursor);
    const dayOfWeek = DAY_OF_WEEK_MAP[currentCursor.getUTCDay()];

    if (holidayDateSet.has(dayStr)) {
      holidaysSkippedCount++;
    } else {
      // Find slots scheduled for this weekday
      const matchingSlots = slots.filter((slot) => slot.dayOfWeek === dayOfWeek);

      for (const slot of matchingSlots) {
        const key = sessionKey(slot.subjectId, dayStr, slot.startTime);
        const existing = existingSessionMap.get(key);

        if (existing) {
          preservedSessionsCount++;
          // Never overwrite sessions with attendance records or conducted/cancelled status
          if (existing.status === "SCHEDULED" && !existing.attendanceRecord) {
            // Optional: keep room/endTime in sync with slot
            if (existing.room !== slot.room || existing.endTime !== slot.endTime) {
              await prisma.classSession.update({
                where: { id: existing.id },
                data: {
                  room: slot.room ?? slot.subject.room,
                  endTime: slot.endTime,
                },
              });
            }
          }
        } else {
          sessionsToCreate.push({
            semesterId: targetSemesterId,
            subjectId: slot.subjectId,
            date: new Date(dayStr),
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room ?? slot.subject.room,
            status: "SCHEDULED",
          });
        }
      }
    }

    // Advance 1 calendar day
    currentCursor.setUTCDate(currentCursor.getUTCDate() + 1);
  }

  // 5. Batch insert new sessions with skipDuplicates to ensure database-level idempotency
  if (sessionsToCreate.length > 0) {
    await prisma.classSession.createMany({
      data: sessionsToCreate,
      skipDuplicates: true,
    });
  }

  const finalTotalSessions = await prisma.classSession.count({
    where: { semesterId: targetSemesterId },
  });

  return {
    semesterId: targetSemesterId,
    semesterName: semester.name,
    startDate: formatDateToIsoDay(semester.startDate),
    endDate: formatDateToIsoDay(semester.endDate),
    generatedSessionsCount: sessionsToCreate.length,
    preservedSessionsCount,
    holidaysSkippedCount,
    totalSessionsCount: finalTotalSessions,
  };
};
