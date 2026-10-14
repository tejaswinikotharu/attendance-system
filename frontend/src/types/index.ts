export interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  targetPercent: number;
  isCurrent: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    subjects: number;
    sessions: number;
  };
}

export interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  color: string;
  targetPercent: number | null;
  professor: string | null;
  room: string | null;
  createdAt?: string;
}

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface TimetableSlot {
  id: string;
  subjectId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string | null;
  subject?: {
    id: string;
    name: string;
    code: string;
    color: string;
    room?: string | null;
  };
}

export type SessionStatus = "SCHEDULED" | "CONDUCTED" | "CANCELLED";
export type AttendanceStatus = "ATTENDED" | "ABSENT" | "PENDING" | "CANCELLED";

export interface DailySession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  sessionStatus: SessionStatus;
  attendanceStatus: AttendanceStatus;
  attendanceRecordId: string | null;
  note: string | null;
  markedAt: string | null;
  subject: {
    id: string;
    name: string;
    code: string;
    color: string;
    room?: string | null;
  };
}

export interface DailyAttendanceResponse {
  date: string;
  totalSessions: number;
  attendedCount: number;
  absentCount: number;
  pendingCount: number;
  cancelledCount: number;
  sessions: DailySession[];
}

export interface AttendanceRecordItem {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  sessionStatus: SessionStatus;
  attendanceStatus: AttendanceStatus;
  note: string | null;
  markedAt: string | null;
  subject: {
    id: string;
    name: string;
    code: string;
    color: string;
  };
}

export interface AttendanceHistoryResponse {
  records: AttendanceRecordItem[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export type StatusBadge = "SAFE" | "WARNING" | "CRITICAL" | "NO_DATA";
export type RecommendationCode =
  | "SAFE_TO_BUNK"
  | "ATTEND"
  | "CRITICAL_ATTEND"
  | "NO_ACTION_NEEDED"
  | "INSUFFICIENT_INFORMATION"
  | "MATHEMATICALLY_IMPOSSIBLE";

export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  color: string;
  targetPercent: number;
  conductedSessions: number;
  attendedSessions: number;
  absentSessions: number;
  pendingSessions: number;
  cancelledSessions: number;
  remainingSessions: number;
  currentPercentage: number | null;
  statusBadge: StatusBadge;
  isMeetingTarget: boolean;
  safeBunks: number;
  requiredToRecover: number;
  recommendationCode: RecommendationCode;
  headline: string;
  mathematicalExplanation: string;
  disclaimer: string;
  isRecoveryPossible?: boolean;
}

export interface PlannerSubjectsResponse {
  semesterId: string;
  subjects: SubjectSummary[];
  disclaimer: string;
}

export interface SimulatedScenarioResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  targetPercent: number;
  currentMetrics: {
    attendedSessions: number;
    conductedSessions: number;
    currentPercentage: number | null;
    isMeetingTarget: boolean;
    safeBunks: number;
    requiredToRecover: number;
  };
  simulatedChanges: {
    totalSimulated: number;
    simulatedAttended: number;
    simulatedMissed: number;
  };
  projectedMetrics: {
    projectedAttended: number;
    projectedConducted: number;
    projectedPercentage: number | null;
    percentageChange: number | null;
    willMeetTarget: boolean;
    projectedSafeBunks: number;
    projectedRecoveryNeeded: number;
    remainingSessionsAfterSim: number;
    isRecoveryFeasibleAfterSim: boolean;
  };
  explanation: string;
  disclaimer: string;
}

export interface ForecastScenario {
  projectedAttended: number;
  projectedConducted: number;
  projectedPercentage: number | null;
  meetsTarget: boolean;
}

export interface SubjectForecast {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  color: string;
  targetPercent: number;
  currentMetrics: {
    attendedSessions: number;
    conductedSessions: number;
    currentPercentage: number | null;
    remainingSessions: number;
  };
  scenarios: {
    attendAllRemaining: ForecastScenario;
    missAllRemaining: ForecastScenario;
    maintainCurrentRate: ForecastScenario;
    customRateScenario?: ForecastScenario & { customRate: number };
  };
}

export interface ForecastResponse {
  semesterId: string;
  subjects: SubjectForecast[];
  disclaimer: string;
}

export interface DeficitSubject {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  color: string;
  targetPercent: number;
  currentPercentage: number | null;
  attendedSessions: number;
  conductedSessions: number;
  remainingSessions: number;
  recoveryClassesNeeded: number;
  isAchievable: boolean;
  shortfall: number;
  maxAchievablePercentage: number;
  recommendationCode: "ATTEND" | "MATHEMATICALLY_IMPOSSIBLE";
  headline: string;
  actionPlan: string;
}

export interface RecoveryPlanResponse {
  semesterId: string;
  totalDeficitSubjectsCount: number;
  deficitSubjects: DeficitSubject[];
  disclaimer: string;
}
