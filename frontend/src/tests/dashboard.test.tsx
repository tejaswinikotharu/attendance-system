import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { api } from "../api/client";
import * as SemesterContextModule from "../context/SemesterContext";

// Mock Recharts ResponsiveContainer to avoid SVG size errors in jsdom
vi.mock("recharts", async () => {
  const actual = await vi.importActual<any>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  };
});

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<any>("../api/client");
  return {
    ...actual,
    api: {
      getPlannerSubjects: vi.fn(),
      getDailyAttendance: vi.fn(),
    },
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe("Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no semester exists", () => {
    vi.spyOn(SemesterContextModule, "useSemester").mockReturnValue({
      semesters: [],
      selectedSemesterId: null,
      selectedSemester: null,
      isLoading: false,
      setSelectedSemesterId: vi.fn(),
      refreshSemesters: vi.fn(),
    });

    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("No Semester Found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create semester & timetable/i })).toBeInTheDocument();
  });

  it("handles subjects with zero conducted classes without displaying misleading 0% or 100%", async () => {
    vi.spyOn(SemesterContextModule, "useSemester").mockReturnValue({
      semesters: [
        {
          id: "sem-1",
          name: "Spring 2026",
          startDate: "2026-01-10",
          endDate: "2026-05-15",
          targetPercent: 75,
          isCurrent: true,
        },
      ],
      selectedSemesterId: "sem-1",
      selectedSemester: {
        id: "sem-1",
        name: "Spring 2026",
        startDate: "2026-01-10",
        endDate: "2026-05-15",
        targetPercent: 75,
        isCurrent: true,
      },
      isLoading: false,
      setSelectedSemesterId: vi.fn(),
      refreshSemesters: vi.fn(),
    });

    (api.getPlannerSubjects as any).mockResolvedValue({
      semesterId: "sem-1",
      subjects: [
        {
          subjectId: "sub-1",
          subjectName: "Algorithms",
          subjectCode: "CS201",
          color: "#2563EB",
          targetPercent: 75,
          conductedSessions: 0,
          attendedSessions: 0,
          absentSessions: 0,
          pendingSessions: 30,
          cancelledSessions: 0,
          remainingSessions: 30,
          currentPercentage: null,
          statusBadge: "NO_DATA",
          isMeetingTarget: true,
          safeBunks: 0,
          requiredToRecover: 0,
          recommendationCode: "INSUFFICIENT_INFORMATION",
          headline: "No evaluated classes yet",
          mathematicalExplanation: "Attendance calculations will appear after the first session.",
          disclaimer: "Projections are integer-safe.",
        },
      ],
      disclaimer: "Disclaimer text",
    });

    (api.getDailyAttendance as any).mockResolvedValue({
      date: "2026-02-01",
      totalSessions: 0,
      attendedCount: 0,
      absentCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
      sessions: [],
    });

    renderWithProviders(<DashboardPage />);

    // When 0 classes conducted, overall attendance must show "—" not 0% or 100%
    expect(await screen.findByText("0 classes evaluated")).toBeInTheDocument();
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("correctly displays live attendance aggregate and safe-bunk counts", async () => {
    vi.spyOn(SemesterContextModule, "useSemester").mockReturnValue({
      semesters: [],
      selectedSemesterId: "sem-1",
      selectedSemester: {
        id: "sem-1",
        name: "Spring 2026",
        startDate: "2026-01-10",
        endDate: "2026-05-15",
        targetPercent: 75,
        isCurrent: true,
      },
      isLoading: false,
      setSelectedSemesterId: vi.fn(),
      refreshSemesters: vi.fn(),
    });

    (api.getPlannerSubjects as any).mockResolvedValue({
      semesterId: "sem-1",
      subjects: [
        {
          subjectId: "sub-1",
          subjectName: "Operating Systems",
          subjectCode: "CS301",
          color: "#2563EB",
          targetPercent: 75,
          conductedSessions: 20,
          attendedSessions: 18,
          absentSessions: 2,
          pendingSessions: 10,
          cancelledSessions: 0,
          remainingSessions: 10,
          currentPercentage: 90.0,
          statusBadge: "SAFE",
          isMeetingTarget: true,
          safeBunks: 4,
          requiredToRecover: 0,
          recommendationCode: "SAFE_TO_BUNK",
          headline: "Safe to skip next 4 classes",
          mathematicalExplanation: "You have a cushion of 4 safe bunks.",
          disclaimer: "Disclaimer text",
        },
      ],
      disclaimer: "Disclaimer text",
    });

    (api.getDailyAttendance as any).mockResolvedValue({
      date: "2026-02-01",
      totalSessions: 1,
      attendedCount: 1,
      absentCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
      sessions: [
        {
          id: "sess-1",
          date: "2026-02-01",
          startTime: "09:00",
          endTime: "10:00",
          room: "LH-1",
          sessionStatus: "CONDUCTED",
          attendanceStatus: "ATTENDED",
          attendanceRecordId: "rec-1",
          note: null,
          markedAt: "2026-02-01T09:30:00Z",
          subject: {
            id: "sub-1",
            name: "Operating Systems",
            code: "CS301",
            color: "#2563EB",
            room: "LH-1",
          },
        },
      ],
    });

    renderWithProviders(<DashboardPage />);

    expect((await screen.findAllByText("90.0%"))[0]).toBeInTheDocument();
    expect(screen.getByText("(18/20 classes attended)")).toBeInTheDocument();
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("Safe to skip next 4 classes")).toBeInTheDocument();
  });
});
