export type SessionStatus = "SCHEDULED" | "CONDUCTED" | "CANCELLED";

export type AttendanceStatus = "ATTENDED" | "ABSENT";

export interface SessionWithAttendance {
  id: string;
  subjectId: string;
  date: Date | string;
  startTime?: string;
  endTime?: string;
  status: SessionStatus;
  attendanceRecord?: {
    id?: string;
    status: AttendanceStatus;
  } | null;
}

export type AttendanceBadge = "SAFE" | "WARNING" | "CRITICAL" | "NO_DATA";

export interface SubjectAttendanceStats {
  subjectId: string;
  targetPercent: number; // 1 to 99
  totalSessions: number;
  conductedSessions: number; // Evaluated: attended + absent
  attendedSessions: number;
  absentSessions: number;
  pendingSessions: number; // Conducted or scheduled past/today sessions lacking explicit response
  cancelledSessions: number;
  remainingSessions: number; // Confirmed future scheduled sessions
  currentPercentage: number | null; // null if conductedSessions === 0
  statusBadge: AttendanceBadge;
}

export type BunkRecommendationCode =
  | "SAFE_TO_SKIP"
  | "ON_THE_EDGE"
  | "ATTEND"
  | "INSUFFICIENT_INFORMATION"
  | "MATHEMATICALLY_IMPOSSIBLE";

export interface BunkPlannerResult {
  targetPercent: number;
  conductedSessions: number;
  attendedSessions: number;
  absentSessions: number;
  remainingSessions: number;
  currentPercentage: number | null;
  isMeetingTarget: boolean;
  safeBunks: number;
  requiredToRecover: number;
  recommendationCode: BunkRecommendationCode;
  headline: string;
  mathematicalExplanation: string;
  disclaimer: string;
}

export interface SimulationResult {
  simulatedAbsences: number;
  currentPercentage: number | null;
  projectedConducted: number;
  projectedAttended: number;
  projectedPercentage: number;
  percentageChange: number;
  willFallBelowTarget: boolean;
  explanation: string;
}

export interface SemesterForecast {
  targetPercent: number;
  currentConducted: number;
  currentAttended: number;
  currentPercentage: number | null;
  remainingSessions: number;
  scenarios: {
    attendAllFuture: {
      projectedPercentage: number;
      conductedTotal: number;
      attendedTotal: number;
      meetsTarget: boolean;
    };
    maintainCurrentRate: {
      projectedPercentage: number | null;
      conductedTotal: number;
      attendedTotal: number;
      meetsTarget: boolean;
    };
    missMaxSafeBunks: {
      projectedPercentage: number;
      conductedTotal: number;
      attendedTotal: number;
      bunksUsed: number;
      meetsTarget: boolean;
    };
  };
  disclaimer: string;
}
