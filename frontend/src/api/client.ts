import {
  AttendanceHistoryResponse,
  AuthResponse,
  DailyAttendanceResponse,
  ForecastResponse,
  HistoricalBaselineItem,
  HistoricalImportCommitResponse,
  HistoricalImportPreviewResponse,
  PlannerSubjectsResponse,
  RecoveryPlanResponse,
  Semester,
  SimulatedScenarioResult,
  Subject,
  TimetableSlot,
  User,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// In-memory token storage (NEVER in localStorage as per strict specification)
let inMemoryToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  inMemoryToken = token;
};

export const getAuthToken = (): string | null => {
  return inMemoryToken;
};

export const setOnUnauthorized = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

export class ApiError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (inMemoryToken) {
    headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      err?.message || "Network error. Please verify the backend is running.",
      0
    );
  }

  if (response.status === 401) {
    setAuthToken(null);
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  }

  // Handle blob or text responses if specified
  const contentType = response.headers.get("content-type");
  if (contentType && (contentType.includes("text/csv") || contentType.includes("application/octet-stream"))) {
    if (!response.ok) {
      throw new ApiError("Failed to download file", response.status);
    }
    return (await response.blob()) as unknown as T;
  }

  let data: any = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    let message = "";
    if (Array.isArray(data?.issues) && data.issues.length > 0) {
      message = data.issues.map((i: any) => i.message || `${i.field} is invalid`).join(", ");
    } else if (Array.isArray(data?.errors) && data.errors.length > 0) {
      message = data.errors.map((e: any) => e.message || (typeof e === "string" ? e : `${e.field} is invalid`)).join(", ");
    } else if (data?.message && data.message !== "Validation Error") {
      message = data.message;
    } else if (data?.error?.message) {
      message = data.error.message;
    } else if (typeof data?.error === "string" && data.error !== "Validation Error") {
      message = data.error;
    } else if (data?.message) {
      message = data.message;
    } else if (typeof data?.error === "string") {
      message = data.error;
    } else {
      message = `HTTP request failed with status ${response.status}`;
    }
    const details = data?.issues || data?.errors || data?.details;
    throw new ApiError(message, response.status, details);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (payload: { email: string; password: string; fullName: string; name?: string }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName,
        name: payload.name || payload.fullName,
      }),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: User }>("/auth/me"),

  // Semesters
  getSemesters: async (): Promise<Semester[]> => {
    const res = await request<{ semesters: Semester[] } | Semester[]>("/semesters");
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).semesters)) return (res as any).semesters;
    return [];
  },
  getCurrentSemester: async (): Promise<Semester | null> => {
    const res = await request<{ semester: Semester | null } | Semester | null>("/semesters/current");
    if (res && "semester" in res) return (res as any).semester;
    return res as Semester | null;
  },
  createSemester: async (payload: {
    name: string;
    startDate: string;
    endDate: string;
    targetPercent?: number;
    isCurrent?: boolean;
  }): Promise<Semester> => {
    const res = await request<{ semester: Semester; message?: string } | Semester>("/semesters", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && "semester" in res) return (res as any).semester;
    return res as Semester;
  },
  updateSemester: async (
    id: string,
    payload: Partial<{
      name: string;
      startDate: string;
      endDate: string;
      targetPercent: number;
      isCurrent: boolean;
    }>
  ): Promise<Semester> => {
    const res = await request<{ semester: Semester; message?: string } | Semester>(`/semesters/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res && "semester" in res) return (res as any).semester;
    return res as Semester;
  },
  deleteSemester: (id: string) =>
    request<{ message: string }>(`/semesters/${id}`, {
      method: "DELETE",
    }),

  // Subjects
  getSubjects: async (semesterId?: string): Promise<Subject[]> => {
    const q = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : "";
    const res = await request<{ subjects: Subject[] } | Subject[]>(`/subjects${q}`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).subjects)) return (res as any).subjects;
    return [];
  },
  createSubject: async (payload: {
    name: string;
    code: string;
    color?: string;
    targetPercent?: number | null;
    professor?: string | null;
    room?: string | null;
    semesterId?: string;
  }): Promise<Subject> => {
    const res = await request<{ subject: Subject; message?: string } | Subject>("/subjects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && "subject" in res) return (res as any).subject;
    return res as Subject;
  },
  updateSubject: async (
    id: string,
    payload: Partial<{
      name: string;
      code: string;
      color: string;
      targetPercent: number | null;
      professor: string | null;
      room: string | null;
    }>
  ): Promise<Subject> => {
    const res = await request<{ subject: Subject; message?: string } | Subject>(`/subjects/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res && "subject" in res) return (res as any).subject;
    return res as Subject;
  },
  deleteSubject: (id: string) =>
    request<{ message: string }>(`/subjects/${id}`, {
      method: "DELETE",
    }),

  // Timetable
  getSlots: async (semesterId?: string): Promise<TimetableSlot[]> => {
    const q = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : "";
    const res = await request<{ slots: TimetableSlot[] } | TimetableSlot[]>(`/timetable/slots${q}`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).slots)) return (res as any).slots;
    return [];
  },
  createSlot: async (payload: {
    subjectId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string | null;
  }): Promise<TimetableSlot> => {
    const res = await request<{ slot: TimetableSlot; message?: string } | TimetableSlot>("/timetable/slots", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && "slot" in res) return (res as any).slot;
    return res as TimetableSlot;
  },
  updateSlot: async (
    id: string,
    payload: Partial<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      room: string | null;
    }>
  ): Promise<TimetableSlot> => {
    const res = await request<{ slot: TimetableSlot; message?: string } | TimetableSlot>(`/timetable/slots/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res && "slot" in res) return (res as any).slot;
    return res as TimetableSlot;
  },
  deleteSlot: (id: string) =>
    request<{ message: string }>(`/timetable/slots/${id}`, {
      method: "DELETE",
    }),
  generateSessions: (semesterId?: string) =>
    request<{ message: string; count: number; dateRange?: { start: string; end: string } }>(
      "/timetable/generate",
      {
        method: "POST",
        body: JSON.stringify(semesterId ? { semesterId } : {}),
      }
    ),
  importCsv: (csvContent: string, semesterId?: string) =>
    request<{
      message: string;
      createdSubjectsCount: number;
      createdSlotsCount: number;
      generatedSessionsCount?: number;
    }>("/timetable/import-csv", {
      method: "POST",
      body: JSON.stringify({ csvContent, semesterId }),
    }),
  downloadCsvTemplate: async () => {
    const res = await fetch(`${BASE_URL}/timetable/template-csv`);
    if (!res.ok) throw new ApiError("Failed to download template", res.status);
    return res.text();
  },

  // Daily Attendance
  getDailyAttendance: (date?: string, semesterId?: string) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (semesterId) params.append("semesterId", semesterId);
    const q = params.toString() ? `?${params.toString()}` : "";
    return request<DailyAttendanceResponse>(`/attendance/daily${q}`);
  },
  markAttendance: (payload: {
    sessionId: string;
    status: "ATTENDED" | "ABSENT";
    note?: string | null;
  }) =>
    request<{
      session: any;
      attendanceRecord: any;
      subjectSummary: any;
    }>("/attendance/mark", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAttendance: (
    sessionId: string,
    payload: {
      status?: "ATTENDED" | "ABSENT";
      note?: string | null;
    }
  ) =>
    request<{
      session: any;
      attendanceRecord: any;
      subjectSummary: any;
    }>(`/attendance/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getAttendanceHistory: (params: {
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    status?: string;
    page?: number;
    limit?: number;
    semesterId?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.append("startDate", params.startDate);
    if (params.endDate) sp.append("endDate", params.endDate);
    if (params.subjectId) sp.append("subjectId", params.subjectId);
    if (params.status) sp.append("status", params.status);
    if (params.page) sp.append("page", String(params.page));
    if (params.limit) sp.append("limit", String(params.limit));
    if (params.semesterId) sp.append("semesterId", params.semesterId);
    const q = sp.toString() ? `?${sp.toString()}` : "";
    return request<AttendanceHistoryResponse>(`/attendance/history${q}`);
  },
  exportAttendanceCsvBlob: async (params: {
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    semesterId?: string;
  }): Promise<Blob> => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.append("startDate", params.startDate);
    if (params.endDate) sp.append("endDate", params.endDate);
    if (params.subjectId) sp.append("subjectId", params.subjectId);
    if (params.semesterId) sp.append("semesterId", params.semesterId);
    const q = sp.toString() ? `?${sp.toString()}` : "";
    const headers: Record<string, string> = {};
    if (inMemoryToken) headers["Authorization"] = `Bearer ${inMemoryToken}`;
    const res = await fetch(`${BASE_URL}/attendance/export-csv${q}`, { headers });
    if (!res.ok) throw new ApiError("Failed to export attendance CSV", res.status);
    return res.blob();
  },

  // Historical Attendance Import & Baselines
  downloadHistoricalCsvTemplate: async () => {
    const headers: Record<string, string> = {};
    if (inMemoryToken) headers["Authorization"] = `Bearer ${inMemoryToken}`;
    const res = await fetch(`${BASE_URL}/attendance/historical-template-csv`, { headers });
    if (!res.ok) throw new ApiError("Failed to download historical attendance template", res.status);
    return res.text();
  },
  previewHistoricalImport: (payload: {
    semesterId?: string;
    rawCsv?: string;
    items?: Array<{ subjectCode: string; subjectName: string; present: number; total: number }>;
  }) =>
    request<HistoricalImportPreviewResponse>("/attendance/historical/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  commitHistoricalImport: (payload: {
    semesterId?: string;
    items: Array<{ subjectCode: string; subjectName: string; present: number; total: number }>;
    overwriteExisting?: boolean;
  }) =>
    request<HistoricalImportCommitResponse>("/attendance/historical/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getHistoricalBaselines: (semesterId?: string) => {
    const q = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : "";
    return request<{ semesterId: string | null; baselines: HistoricalBaselineItem[] }>(
      `/attendance/historical${q}`
    );
  },
  deleteHistoricalBaseline: (subjectId: string) =>
    request<{ message: string; subjectId: string }>(`/attendance/historical/${subjectId}`, {
      method: "DELETE",
    }),

  // Planner
  getPlannerSubjects: (semesterId?: string) => {
    const q = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : "";
    return request<PlannerSubjectsResponse>(`/planner/subjects${q}`);
  },
  simulateAttendance: (payload: {
    subjectId: string;
    semesterId?: string;
    simulatedSessions: { sessionId: string; action: "ATTEND" | "MISS" }[];
  }) =>
    request<SimulatedScenarioResult>("/planner/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSemesterForecasts: (params?: { semesterId?: string; customAttendanceRate?: number }) => {
    const sp = new URLSearchParams();
    if (params?.semesterId) sp.append("semesterId", params.semesterId);
    if (params?.customAttendanceRate !== undefined) {
      sp.append("customAttendanceRate", String(params.customAttendanceRate));
    }
    const q = sp.toString() ? `?${sp.toString()}` : "";
    return request<ForecastResponse>(`/planner/forecast${q}`);
  },
  getRecoveryPlan: (semesterId?: string) => {
    const q = semesterId ? `?semesterId=${encodeURIComponent(semesterId)}` : "";
    return request<RecoveryPlanResponse>(`/planner/recovery${q}`);
  },
};
