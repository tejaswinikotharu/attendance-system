import { DayOfWeek } from "@prisma/client";
import { AppError } from "../middleware/error.middleware.js";
import { getAuthorizedSemester } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";
import { getCurrentSemester } from "./semester.service.js";
import { generateSemesterSessions } from "./timetableGenerator.service.js";

const VALID_DAYS = new Set<string>([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface CsvRowError {
  row: number;
  column?: string;
  message: string;
}

export interface CsvImportResult {
  success: boolean;
  message: string;
  errors?: CsvRowError[];
  importedSubjectsCount?: number;
  importedSlotsCount?: number;
  generatedSessionsCount?: number;
}

/**
 * Returns a standardized CSV template string with header and realistic demonstration rows.
 */
export function getTimetableCsvTemplate(): string {
  return [
    "subjectCode,subjectName,dayOfWeek,startTime,endTime,room,targetPercent,professor,color",
    "CS501,Computer Networks,MONDAY,09:00,10:00,Lab 3,75,Dr. Miller,#2563EB",
    "CS501,Computer Networks,WEDNESDAY,09:00,10:00,Lab 3,75,Dr. Miller,#2563EB",
    "CS502,Operating Systems,TUESDAY,10:15,11:15,Room 402,80,Prof. Davis,#10B981",
    "CS502,Operating Systems,THURSDAY,10:15,11:15,Room 402,80,Prof. Davis,#10B981",
    "CS503,Software Engineering,FRIDAY,11:30,12:30,Hall B,75,Dr. Taylor,#8B5CF6",
  ].join("\n");
}

interface ParsedTimetableRow {
  rowNumber: number;
  subjectCode: string;
  subjectName: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string;
  targetPercent?: number;
  professor?: string;
  color: string;
}

/**
 * Parses and validates CSV content line by line.
 * Collects all syntax and semantic row errors before attempting any database writes.
 */
export function parseAndValidateCsv(csvContent: string): {
  rows: ParsedTimetableRow[];
  errors: CsvRowError[];
} {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const errors: CsvRowError[] = [];
  const rows: ParsedTimetableRow[] = [];

  if (lines.length < 2) {
    errors.push({
      row: 1,
      message: "CSV must contain a header row and at least one data row.",
    });
    return { rows, errors };
  }

  // Parse header
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase());

  const requiredHeaders = ["subjectcode", "subjectname", "dayofweek", "starttime", "endtime"];
  for (const req of requiredHeaders) {
    if (!headers.includes(req)) {
      errors.push({
        row: 1,
        column: req,
        message: `Missing required header column: "${req}"`,
      });
    }
  }

  if (errors.length > 0) {
    return { rows, errors };
  }

  const colIndex = (name: string) => headers.indexOf(name.toLowerCase());
  const idxCode = colIndex("subjectcode");
  const idxName = colIndex("subjectname");
  const idxDay = colIndex("dayofweek");
  const idxStart = colIndex("starttime");
  const idxEnd = colIndex("endtime");
  const idxRoom = colIndex("room");
  const idxTarget = colIndex("targetpercent");
  const idxProf = colIndex("professor");
  const idxColor = colIndex("color");

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = lines[i].split(",").map((c) => c.trim());

    const subjectCode = cols[idxCode]?.toUpperCase();
    const subjectName = cols[idxName];
    const rawDay = cols[idxDay]?.toUpperCase();
    const startTime = cols[idxStart];
    const endTime = cols[idxEnd];
    const room = idxRoom !== -1 && cols[idxRoom] ? cols[idxRoom] : undefined;
    const rawTarget = idxTarget !== -1 && cols[idxTarget] ? cols[idxTarget] : undefined;
    const professor = idxProf !== -1 && cols[idxProf] ? cols[idxProf] : undefined;
    const rawColor = idxColor !== -1 && cols[idxColor] ? cols[idxColor] : undefined;

    if (!subjectCode) {
      errors.push({ row: rowNum, column: "subjectCode", message: "Subject code is required." });
    }
    if (!subjectName) {
      errors.push({ row: rowNum, column: "subjectName", message: "Subject name is required." });
    }

    if (!rawDay || !VALID_DAYS.has(rawDay)) {
      errors.push({
        row: rowNum,
        column: "dayOfWeek",
        message: `Invalid dayOfWeek "${rawDay}". Must be one of: ${Array.from(VALID_DAYS).join(", ")}.`,
      });
    }

    if (!startTime || !TIME_REGEX.test(startTime)) {
      errors.push({
        row: rowNum,
        column: "startTime",
        message: `Start time "${startTime}" is invalid. Format must be HH:mm (24-hour).`,
      });
    }

    if (!endTime || !TIME_REGEX.test(endTime)) {
      errors.push({
        row: rowNum,
        column: "endTime",
        message: `End time "${endTime}" is invalid. Format must be HH:mm (24-hour).`,
      });
    }

    if (startTime && endTime && TIME_REGEX.test(startTime) && TIME_REGEX.test(endTime)) {
      if (startTime >= endTime) {
        errors.push({
          row: rowNum,
          column: "endTime",
          message: `Start time (${startTime}) must be strictly before end time (${endTime}).`,
        });
      }
    }

    let targetPercent: number | undefined;
    if (rawTarget) {
      const parsed = parseInt(rawTarget, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 99) {
        errors.push({
          row: rowNum,
          column: "targetPercent",
          message: `Target percent must be an integer between 1 and 99. Got "${rawTarget}".`,
        });
      } else {
        targetPercent = parsed;
      }
    }

    let color = "#2563EB";
    if (rawColor) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(rawColor)) {
        errors.push({
          row: rowNum,
          column: "color",
          message: `Color "${rawColor}" must be a 6-digit hex code (e.g. #2563EB).`,
        });
      } else {
        color = rawColor;
      }
    }

    if (subjectCode && subjectName && rawDay && VALID_DAYS.has(rawDay) && startTime && endTime && startTime < endTime) {
      rows.push({
        rowNumber: rowNum,
        subjectCode,
        subjectName,
        dayOfWeek: rawDay as DayOfWeek,
        startTime,
        endTime,
        room,
        targetPercent,
        professor,
        color,
      });
    }
  }

  return { rows, errors };
}

/**
 * Atomically imports subjects and timetable slots from a validated CSV.
 * Uses a single database transaction:
 * If any error occurs or validation fails, ALL writes roll back completely.
 */
export const importTimetableCsv = async (
  userId: string,
  csvContent: string,
  semesterId?: string
): Promise<CsvImportResult> => {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (!current) {
      const error: AppError = new Error(
        "No active semester found. Create a semester before importing a timetable."
      );
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = current.id;
  }

  await getAuthorizedSemester(targetSemesterId, userId);

  // Parse and validate entire CSV up front
  const { rows, errors } = parseAndValidateCsv(csvContent);

  if (errors.length > 0) {
    return {
      success: false,
      message: `CSV validation failed with ${errors.length} error(s). No changes were applied.`,
      errors,
    };
  }

  // Atomic database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Group rows by unique subjectCode
    const subjectMap = new Map<string, { name: string; targetPercent?: number; professor?: string; color: string; room?: string }>();

    for (const r of rows) {
      if (!subjectMap.has(r.subjectCode)) {
        subjectMap.set(r.subjectCode, {
          name: r.subjectName,
          targetPercent: r.targetPercent,
          professor: r.professor,
          color: r.color,
          room: r.room,
        });
      }
    }

    // 2. Upsert subjects for this semester
    const createdSubjectIds = new Map<string, string>();

    for (const [code, info] of subjectMap.entries()) {
      const subject = await tx.subject.upsert({
        where: {
          semesterId_code: {
            semesterId: targetSemesterId!,
            code,
          },
        },
        update: {
          name: info.name,
          targetPercent: info.targetPercent,
          professor: info.professor,
          color: info.color,
          room: info.room,
        },
        create: {
          semesterId: targetSemesterId!,
          code,
          name: info.name,
          targetPercent: info.targetPercent,
          professor: info.professor,
          color: info.color,
          room: info.room,
        },
      });

      createdSubjectIds.set(code, subject.id);
    }

    // 3. Create timetable slots
    let importedSlotsCount = 0;
    for (const row of rows) {
      const subjectId = createdSubjectIds.get(row.subjectCode);
      if (!subjectId) continue;

      // Check if identical slot already exists to prevent duplication
      const existingSlot = await tx.timetableSlot.findFirst({
        where: {
          subjectId,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
        },
      });

      if (!existingSlot) {
        await tx.timetableSlot.create({
          data: {
            subjectId,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
            room: row.room,
          },
        });
        importedSlotsCount++;
      }
    }

    return {
      importedSubjectsCount: subjectMap.size,
      importedSlotsCount,
    };
  });

  // 4. Automatically generate dated sessions for the semester
  const generation = await generateSemesterSessions(userId, targetSemesterId);

  return {
    success: true,
    message: `Timetable successfully imported! Processed ${result.importedSubjectsCount} subject(s) and ${result.importedSlotsCount} slot(s).`,
    importedSubjectsCount: result.importedSubjectsCount,
    importedSlotsCount: result.importedSlotsCount,
    generatedSessionsCount: generation.generatedSessionsCount,
  };
};
