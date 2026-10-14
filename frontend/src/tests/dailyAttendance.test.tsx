import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyAttendancePage } from "../pages/attendance/DailyAttendancePage";
import { ToastProvider } from "../components/ui/Toast";
import { api } from "../api/client";
import * as SemesterContextModule from "../context/SemesterContext";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<any>("../api/client");
  return {
    ...actual,
    api: {
      getDailyAttendance: vi.fn(),
      markAttendance: vi.fn(),
      updateAttendance: vi.fn(),
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

describe("Daily Attendance Marking Page", () => {
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

  it("renders scheduled classes and triggers attendance marking mutation", async () => {
    (api.getDailyAttendance as any).mockResolvedValue({
      date: "2026-02-01",
      totalSessions: 1,
      attendedCount: 0,
      absentCount: 0,
      pendingCount: 1,
      cancelledCount: 0,
      sessions: [
        {
          id: "sess-abc",
          date: "2026-02-01",
          startTime: "10:00",
          endTime: "11:00",
          room: "Room 204",
          sessionStatus: "SCHEDULED",
          attendanceStatus: "PENDING",
          attendanceRecordId: null,
          note: null,
          markedAt: null,
          subject: {
            id: "sub-1",
            name: "Database Systems",
            code: "CS401",
            color: "#059669",
            room: "Room 204",
          },
        },
      ],
    });

    (api.markAttendance as any).mockResolvedValue({
      session: { id: "sess-abc", status: "CONDUCTED" },
      attendanceRecord: { id: "rec-1", status: "ATTENDED" },
      subjectSummary: { subjectName: "Database Systems" },
    });

    renderWithProviders(<DailyAttendancePage />);

    expect(await screen.findByText("Database Systems")).toBeInTheDocument();
    expect(screen.getByText("10:00 – 11:00")).toBeInTheDocument();
    expect(screen.getAllByText("PENDING")[0]).toBeInTheDocument();

    const attendBtn = screen.getByRole("button", { name: /^attended$/i });
    await userEvent.click(attendBtn);

    await waitFor(() => {
      expect(api.markAttendance).toHaveBeenCalledWith({
        sessionId: "sess-abc",
        status: "ATTENDED",
      });
    });
  });
});
