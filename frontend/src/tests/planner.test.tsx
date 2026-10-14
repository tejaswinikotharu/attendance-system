import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BunkPlannerPage } from "../pages/planner/BunkPlannerPage";
import { ToastProvider } from "../components/ui/Toast";
import { api } from "../api/client";
import * as SemesterContextModule from "../context/SemesterContext";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<any>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<any>("../api/client");
  return {
    ...actual,
    api: {
      getPlannerSubjects: vi.fn(),
      getSemesterForecasts: vi.fn(),
      getRecoveryPlan: vi.fn(),
      getAttendanceHistory: vi.fn(),
      simulateAttendance: vi.fn(),
    },
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
};

describe("Smart Bunk Planner & What-If Simulator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("renders safe bunk cushion and subject recommendations correctly", async () => {
    (api.getPlannerSubjects as any).mockResolvedValue({
      semesterId: "sem-1",
      subjects: [
        {
          subjectId: "sub-1",
          subjectName: "Computer Networks",
          subjectCode: "CS501",
          color: "#4F46E5",
          targetPercent: 75,
          conductedSessions: 20,
          attendedSessions: 18,
          absentSessions: 2,
          pendingSessions: 15,
          cancelledSessions: 0,
          remainingSessions: 15,
          currentPercentage: 90.0,
          statusBadge: "SAFE",
          isMeetingTarget: true,
          safeBunks: 4,
          requiredToRecover: 0,
          recommendationCode: "SAFE_TO_BUNK",
          headline: "Safe to skip next 4 classes",
          mathematicalExplanation: "Attendance will remain at 75.0% after 4 absences.",
          disclaimer: "Disclaimer text",
        },
      ],
      disclaimer: "Disclaimer text",
    });

    (api.getSemesterForecasts as any).mockResolvedValue({
      semesterId: "sem-1",
      subjects: [],
      disclaimer: "Disclaimer text",
    });

    (api.getRecoveryPlan as any).mockResolvedValue({
      semesterId: "sem-1",
      totalDeficitSubjectsCount: 0,
      deficitSubjects: [],
      disclaimer: "Disclaimer text",
    });

    (api.getAttendanceHistory as any).mockResolvedValue({
      records: [
        {
          sessionId: "sess-future-1",
          date: "2026-02-15",
          startTime: "10:00",
          endTime: "11:00",
          room: "Room 101",
          sessionStatus: "SCHEDULED",
          attendanceStatus: "PENDING",
        },
      ],
      pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 15 },
    });

    renderWithProviders(<BunkPlannerPage />);

    expect((await screen.findAllByText("Computer Networks"))[0]).toBeInTheDocument();
    expect(screen.getByText("Safe to skip next 4 classes")).toBeInTheDocument();
    expect(screen.getByText("All Subjects Meet Attendance Target!")).toBeInTheDocument();
  });

  it("executes what-if simulation when future sessions are staged", async () => {
    (api.getPlannerSubjects as any).mockResolvedValue({
      semesterId: "sem-1",
      subjects: [
        {
          subjectId: "sub-1",
          subjectName: "Computer Networks",
          subjectCode: "CS501",
          color: "#4F46E5",
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
          mathematicalExplanation: "Cushion available",
          disclaimer: "Disclaimer text",
        },
      ],
      disclaimer: "Disclaimer text",
    });

    (api.getSemesterForecasts as any).mockResolvedValue({
      semesterId: "sem-1",
      subjects: [],
      disclaimer: "Disclaimer text",
    });

    (api.getRecoveryPlan as any).mockResolvedValue({
      semesterId: "sem-1",
      totalDeficitSubjectsCount: 0,
      deficitSubjects: [],
      disclaimer: "Disclaimer text",
    });

    (api.getAttendanceHistory as any).mockResolvedValue({
      records: [
        {
          sessionId: "sess-100",
          date: "2026-02-15",
          startTime: "10:00",
          endTime: "11:00",
          room: "Room 101",
          sessionStatus: "SCHEDULED",
          attendanceStatus: "PENDING",
        },
      ],
      pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 15 },
    });

    (api.simulateAttendance as any).mockResolvedValue({
      subjectId: "sub-1",
      subjectName: "Computer Networks",
      subjectCode: "CS501",
      targetPercent: 75,
      currentMetrics: {
        attendedSessions: 18,
        conductedSessions: 20,
        currentPercentage: 90.0,
        isMeetingTarget: true,
        safeBunks: 4,
        requiredToRecover: 0,
      },
      simulatedChanges: {
        totalSimulated: 1,
        simulatedAttended: 1,
        simulatedMissed: 0,
      },
      projectedMetrics: {
        projectedAttended: 19,
        projectedConducted: 21,
        projectedPercentage: 90.48,
        percentageChange: 0.48,
        willMeetTarget: true,
        projectedSafeBunks: 4,
        projectedRecoveryNeeded: 0,
        remainingSessionsAfterSim: 9,
        isRecoveryFeasibleAfterSim: true,
      },
      explanation: "Projected attendance becomes 19/21 (90.48%), which meets your target of 75%.",
      disclaimer: "Projections are derived from integer-safe mathematical models.",
    });

    renderWithProviders(<BunkPlannerPage />);

    expect((await screen.findAllByText("Computer Networks"))[0]).toBeInTheDocument();

    // In What-If simulator, click Attend for sess-100
    const attendButtons = await screen.findAllByRole("button", { name: /^attend$/i });
    await userEvent.click(attendButtons[0]);

    // Click Simulate button
    const simulateBtn = screen.getByRole("button", { name: /simulate \(1\)/i });
    await userEvent.click(simulateBtn);

    await waitFor(() => {
      expect(api.simulateAttendance).toHaveBeenCalledWith({
        subjectId: "sub-1",
        semesterId: "sem-1",
        simulatedSessions: [{ sessionId: "sess-100", action: "ATTEND" }],
      });
    });

    expect(await screen.findByText("90.5%")).toBeInTheDocument();
    expect(screen.getByText("Meets Target")).toBeInTheDocument();
  });
});
