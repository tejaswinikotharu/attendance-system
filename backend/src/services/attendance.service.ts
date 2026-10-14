import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/error.middleware.js";
import {
  AttendanceHistoryQuery,
  ExportAttendanceCsvQuery,
  MarkAttendanceInput,
  UpdateAttendanceInput,
} from "../schemas/attendance.schema.js";
import { SessionWithAttendance } from "../types/attendance.js";
import { prisma } from "../utils/db.js";
import { calculateSubjectAttendance } from "./attendanceEngine.js";
import { generateBunkRecommendation } from "./bunkPlanner.js";
import { getCurrentSemester } from "./semester.service.js";

/**
 * Escapes CSV special characters according to RFC 4180 standards.
 */
export function escapeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Calculates current attendance metrics and bunk planner recommendations for a subject.
 * Leverages the pure calculation utilities in attendanceEngine.ts and bunkPlanner.ts.
 */
export const getSubjectSummary = async (
  subjectId: string,
  userId: string,
  referenceDate: Date = new Date()
) => {
  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      semester: { userId },
    },
    include: { semester: true },
  });

  if (!subject) {
    const error: AppError = new Error("Subject not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  const sessions = await prisma.classSession.findMany({
    where: { subjectId },
    include: { attendanceRecord: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const targetPercent =
    subject.targetPercent ?? subject.semester.targetPercent ?? 75;

  const stats = calculateSubjectAttendance(
    subject.id,
    sessions as unknown as SessionWithAttendance[],
    targetPercent,
    referenceDate
  );

  const recommendation = generateBunkRecommendation(stats);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code,
    color: subject.color,
    targetPercent,
    conductedSessions: stats.conductedSessions,
    attendedSessions: stats.attendedSessions,
    absentSessions: stats.absentSessions,
    pendingSessions: stats.pendingSessions,
    cancelledSessions: stats.cancelledSessions,
    remainingSessions: stats.remainingSessions,
    currentPercentage: stats.currentPercentage,
    statusBadge: stats.statusBadge,
    isMeetingTarget: recommendation.isMeetingTarget,
    safeBunks: recommendation.safeBunks,
    requiredToRecover: recommendation.requiredToRecover,
    recommendationCode: recommendation.recommendationCode,
    headline: recommendation.headline,
    mathematicalExplanation: recommendation.mathematicalExplanation,
    disclaimer: recommendation.disclaimer,
  };
};

/**
 * Fetches class sessions for a specific calendar day with live attendance status.
 * Unmarked sessions are returned as PENDING without creating premature database rows.
 */
export const getDailySessions = async (
  userId: string,
  dateStr?: string,
  semesterId?: string
) => {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (current) {
      targetSemesterId = current.id;
    }
  }

  const queryDate = dateStr ? new Date(dateStr) : new Date();
  queryDate.setUTCHours(0, 0, 0, 0);

  const sessions = await prisma.classSession.findMany({
    where: {
      semester: {
        userId,
        ...(targetSemesterId ? { id: targetSemesterId } : {}),
      },
      date: queryDate,
    },
    orderBy: { startTime: "asc" },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          room: true,
        },
      },
      attendanceRecord: true,
    },
  });

  let attendedCount = 0;
  let absentCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;

  const mappedSessions = sessions.map((session) => {
    let attendanceStatus: "ATTENDED" | "ABSENT" | "PENDING" | "CANCELLED" = "PENDING";

    if (session.status === "CANCELLED") {
      attendanceStatus = "CANCELLED";
      cancelledCount++;
    } else if (session.attendanceRecord) {
      attendanceStatus = session.attendanceRecord.status;
      if (attendanceStatus === "ATTENDED") attendedCount++;
      if (attendanceStatus === "ABSENT") absentCount++;
    } else {
      attendanceStatus = "PENDING";
      pendingCount++;
    }

    return {
      id: session.id,
      date: session.date.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room ?? session.subject.room,
      sessionStatus: session.status,
      attendanceStatus,
      attendanceRecordId: session.attendanceRecord?.id ?? null,
      note: session.attendanceRecord?.note ?? session.note ?? null,
      markedAt: session.attendanceRecord?.markedAt ?? null,
      subject: session.subject,
    };
  });

  return {
    date: queryDate.toISOString().slice(0, 10),
    totalSessions: sessions.length,
    attendedCount,
    absentCount,
    pendingCount,
    cancelledCount,
    sessions: mappedSessions,
  };
};

/**
 * Marks attendance for a conducted session.
 * Enforces business rules:
 * 1. Cancelled sessions cannot be marked.
 * 2. Future scheduled sessions cannot be marked before occurring.
 * 3. Transitions session.status to CONDUCTED if previously SCHEDULED.
 * 4. Upserts 1:1 AttendanceRecord.
 * 5. Returns updated subject attendance calculations and bunk metrics.
 */
export const markAttendance = async (
  userId: string,
  input: MarkAttendanceInput
) => {
  const session = await prisma.classSession.findFirst({
    where: {
      id: input.sessionId,
      semester: { userId },
    },
    include: {
      subject: true,
      semester: true,
      attendanceRecord: true,
    },
  });

  if (!session) {
    const error: AppError = new Error("Class session not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  // Business Rule 1: Cancelled sessions cannot be marked
  if (session.status === "CANCELLED") {
    const error: AppError = new Error(
      "Cannot mark attendance for a cancelled class session. Cancelled sessions are not conducted."
    );
    error.statusCode = 400;
    throw error;
  }

  // Business Rule 2: Future scheduled sessions cannot be marked
  const todayStr = new Date().toISOString().slice(0, 10);
  const sessionDateStr = session.date.toISOString().slice(0, 10);

  if (sessionDateStr > todayStr && session.status === "SCHEDULED") {
    const error: AppError = new Error(
      `Cannot mark attendance for a future scheduled session (${sessionDateStr}). Only completed or current classes can be marked.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Atomic database transaction
  const record = await prisma.$transaction(async (tx) => {
    // Transition session status to CONDUCTED if it was SCHEDULED
    if (session.status === "SCHEDULED") {
      await tx.classSession.update({
        where: { id: session.id },
        data: { status: "CONDUCTED" },
      });
    }

    // Upsert attendance record (1:1 relation guarantee prevents duplicate rows)
    return await tx.attendanceRecord.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        status: input.status,
        note: input.note,
        markedAt: new Date(),
      },
      update: {
        status: input.status,
        note: input.note,
        updatedAt: new Date(),
      },
    });
  });

  // Calculate updated subject attendance and bunk recommendation
  const subjectSummary = await getSubjectSummary(session.subjectId, userId);

  return {
    message: "Attendance marked successfully",
    record,
    subjectSummary,
  };
};

/**
 * Updates or corrects an existing attendance entry.
 */
export const updateAttendance = async (
  userId: string,
  sessionId: string,
  input: UpdateAttendanceInput
) => {
  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      semester: { userId },
    },
    include: {
      attendanceRecord: true,
    },
  });

  if (!session) {
    const error: AppError = new Error("Class session not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  if (session.status === "CANCELLED") {
    const error: AppError = new Error("Cannot update attendance for a cancelled session.");
    error.statusCode = 400;
    throw error;
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId: session.id },
    create: {
      sessionId: session.id,
      status: input.status ?? "ATTENDED",
      note: input.note,
      markedAt: new Date(),
    },
    update: {
      status: input.status,
      note: input.note,
      updatedAt: new Date(),
    },
  });

  const subjectSummary = await getSubjectSummary(session.subjectId, userId);

  return {
    message: "Attendance updated successfully",
    record,
    subjectSummary,
  };
};

/**
 * Retrieves attendance status and subject summary for a particular session.
 */
export const getSessionAttendance = async (
  userId: string,
  sessionId: string
) => {
  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      semester: { userId },
    },
    include: {
      subject: true,
      attendanceRecord: true,
    },
  });

  if (!session) {
    const error: AppError = new Error("Class session not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  const subjectSummary = await getSubjectSummary(session.subjectId, userId);

  return {
    session: {
      id: session.id,
      date: session.date.toISOString().slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room ?? session.subject.room,
      sessionStatus: session.status,
      attendanceStatus: session.status === "CANCELLED"
        ? "CANCELLED"
        : session.attendanceRecord?.status ?? "PENDING",
      attendanceRecord: session.attendanceRecord,
      subject: session.subject,
    },
    subjectSummary,
  };
};

/**
 * Filterable, paginated attendance history with stable sorting.
 */
export const getAttendanceHistory = async (
  userId: string,
  query: AttendanceHistoryQuery
) => {
  const where: Prisma.ClassSessionWhereInput = {
    semester: {
      userId,
      ...(query.semesterId ? { id: query.semesterId } : {}),
    },
  };

  if (query.subjectId) {
    where.subjectId = query.subjectId;
  }

  if (query.startDate || query.endDate) {
    where.date = {};
    if (query.startDate) {
      where.date.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      where.date.lte = new Date(query.endDate);
    }
  }

  // Attendance status filter
  if (query.status) {
    if (query.status === "CANCELLED") {
      where.status = "CANCELLED";
    } else if (query.status === "PENDING") {
      where.status = { not: "CANCELLED" };
      where.attendanceRecord = null;
    } else if (query.status === "ATTENDED" || query.status === "ABSENT") {
      where.status = { not: "CANCELLED" };
      where.attendanceRecord = { status: query.status };
    }
  }

  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 20), 10) || 20));
  const totalItems = await prisma.classSession.count({ where });
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const skip = (page - 1) * limit;

  const sessions = await prisma.classSession.findMany({
    where,
    skip,
    take: limit,
    orderBy: [
      { date: "desc" },
      { startTime: "asc" },
    ],
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
      attendanceRecord: true,
    },
  });

  const records = sessions.map((s) => ({
    sessionId: s.id,
    date: s.date.toISOString().slice(0, 10),
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room,
    sessionStatus: s.status,
    attendanceStatus: s.status === "CANCELLED"
      ? "CANCELLED"
      : s.attendanceRecord?.status ?? "PENDING",
    note: s.attendanceRecord?.note ?? s.note ?? null,
    markedAt: s.attendanceRecord?.markedAt ?? null,
    subject: s.subject,
  }));

  return {
    records,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      limit,
    },
  };
};

/**
 * Generates an RFC-4180 compliant CSV export of student attendance history.
 */
export const exportAttendanceCsv = async (
  userId: string,
  query: ExportAttendanceCsvQuery
): Promise<string> => {
  const where: Prisma.ClassSessionWhereInput = {
    semester: {
      userId,
      ...(query.semesterId ? { id: query.semesterId } : {}),
    },
  };

  if (query.subjectId) {
    where.subjectId = query.subjectId;
  }

  if (query.startDate || query.endDate) {
    where.date = {};
    if (query.startDate) {
      where.date.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      where.date.lte = new Date(query.endDate);
    }
  }

  const sessions = await prisma.classSession.findMany({
    where,
    orderBy: [
      { date: "desc" },
      { startTime: "asc" },
    ],
    include: {
      subject: true,
      attendanceRecord: true,
    },
  });

  const header = [
    "Date",
    "Subject Code",
    "Subject Name",
    "Start Time",
    "End Time",
    "Session Status",
    "Attendance Status",
    "Notes",
  ].join(",");

  const rows = sessions.map((s) => {
    const attendanceStatus = s.status === "CANCELLED"
      ? "CANCELLED"
      : s.attendanceRecord?.status ?? "PENDING";

    const note = s.attendanceRecord?.note ?? s.note ?? "";

    return [
      escapeCsvValue(s.date.toISOString().slice(0, 10)),
      escapeCsvValue(s.subject.code),
      escapeCsvValue(s.subject.name),
      escapeCsvValue(s.startTime),
      escapeCsvValue(s.endTime),
      escapeCsvValue(s.status),
      escapeCsvValue(attendanceStatus),
      escapeCsvValue(note),
    ].join(",");
  });

  return [header, ...rows].join("\n");
};
