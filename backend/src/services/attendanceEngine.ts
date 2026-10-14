import {
  AttendanceBadge,
  SessionWithAttendance,
  SubjectAttendanceStats,
} from "../types/attendance.js";

/**
 * Validates the student's target attendance threshold.
 * Strictly enforces that targets must be an integer between 1% and 99%.
 * Targets of 0% and 100% are rejected to prevent invalid or degenerate mathematical states.
 */
export function validateTargetPercent(targetPercent: number): number {
  if (
    typeof targetPercent !== "number" ||
    !Number.isFinite(targetPercent) ||
    !Number.isInteger(targetPercent)
  ) {
    throw new Error("Target attendance must be an integer percentage.");
  }

  if (targetPercent <= 0) {
    throw new Error(
      "Invalid attendance target: Target must be greater than 0%. A 0% target is trivial and disables planner calculations."
    );
  }

  if (targetPercent >= 100) {
    throw new Error(
      "Invalid attendance target: Target must be strictly less than 100%. Maintaining 100% attendance makes recovery impossible after any single absence."
    );
  }

  return targetPercent;
}

/**
 * Normalizes a date or date string to midnight UTC for fair calendar day comparisons.
 */
export function normalizeDateToMidnight(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Pure calculation engine for subject attendance metrics.
 * Follows exact institutional and mathematical rules:
 * 1. Cancelled classes are NEVER counted as conducted.
 * 2. Unmarked sessions are PENDING and NEVER automatically counted as absences.
 * 3. Zero conducted classes safely return a null percentage rather than a misleading 100%.
 */
export function calculateSubjectAttendance(
  subjectId: string,
  sessions: SessionWithAttendance[],
  rawTargetPercent: number,
  referenceDate: Date = new Date()
): SubjectAttendanceStats {
  const targetPercent = validateTargetPercent(rawTargetPercent);
  const refTime = normalizeDateToMidnight(referenceDate);

  let attendedSessions = 0;
  let absentSessions = 0;
  let pendingSessions = 0;
  let cancelledSessions = 0;
  let remainingSessions = 0;

  for (const session of sessions) {
    // Rule: Cancelled sessions never count as conducted or pending
    if (session.status === "CANCELLED") {
      cancelledSessions++;
      continue;
    }

    const sessionTime = normalizeDateToMidnight(session.date);
    const hasRecord = Boolean(session.attendanceRecord);

    if (hasRecord) {
      if (session.attendanceRecord!.status === "ATTENDED") {
        attendedSessions++;
      } else if (session.attendanceRecord!.status === "ABSENT") {
        absentSessions++;
      }
    } else {
      // No attendance record yet
      if (sessionTime > refTime) {
        // Confirmed future scheduled session
        remainingSessions++;
      } else {
        // Today or past session without a student response: PENDING
        // Never automatically counted as absence!
        pendingSessions++;
      }
    }
  }

  // Conducted is strictly evaluated classes with confirmed attendance response
  const conductedSessions = attendedSessions + absentSessions;

  // Safe percentage calculation: null when 0 conducted classes
  let currentPercentage: number | null = null;
  if (conductedSessions > 0) {
    // Preserve two decimal places cleanly
    currentPercentage =
      Math.round((attendedSessions / conductedSessions) * 10000) / 100;
  }

  // Determine visual status badge
  let statusBadge: AttendanceBadge = "NO_DATA";
  if (conductedSessions > 0 && currentPercentage !== null) {
    // Exact integer comparison: (A * 100) >= (T * C)
    const meetsTarget = attendedSessions * 100 >= targetPercent * conductedSessions;
    if (meetsTarget) {
      statusBadge = "SAFE";
    } else {
      // Deficit evaluation: warning if deficit can be recovered in <= 2 classes
      const deficitClasses = Math.ceil(
        (targetPercent * conductedSessions - 100 * attendedSessions) /
          (100 - targetPercent)
      );
      statusBadge = deficitClasses <= 2 ? "WARNING" : "CRITICAL";
    }
  }

  return {
    subjectId,
    targetPercent,
    totalSessions: sessions.length,
    conductedSessions,
    attendedSessions,
    absentSessions,
    pendingSessions,
    cancelledSessions,
    remainingSessions,
    currentPercentage,
    statusBadge,
  };
}
