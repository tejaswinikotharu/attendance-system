import { describe, expect, it } from "vitest";
import {
  calculateSubjectAttendance,
  validateTargetPercent,
} from "../../src/services/attendanceEngine.js";
import { SessionWithAttendance } from "../../src/types/attendance.js";

describe("AttendanceEngine — Unit Tests", () => {
  describe("Target Attendance Threshold Validation", () => {
    it("accepts valid integer targets from 1% to 99%", () => {
      expect(validateTargetPercent(1)).toBe(1);
      expect(validateTargetPercent(75)).toBe(75);
      expect(validateTargetPercent(80)).toBe(80);
      expect(validateTargetPercent(99)).toBe(99);
    });

    it("rejects 0% target with a clear error", () => {
      expect(() => validateTargetPercent(0)).toThrow(
        /Invalid attendance target: Target must be greater than 0%/
      );
    });

    it("rejects 100% target with a clear error", () => {
      expect(() => validateTargetPercent(100)).toThrow(
        /Invalid attendance target: Target must be strictly less than 100%/
      );
    });

    it("rejects negative target values", () => {
      expect(() => validateTargetPercent(-15)).toThrow();
    });

    it("rejects targets greater than 100%", () => {
      expect(() => validateTargetPercent(105)).toThrow();
    });

    it("rejects non-integer targets to maintain integer-safe calculations", () => {
      expect(() => validateTargetPercent(75.5)).toThrow(
        /Target attendance must be an integer percentage/
      );
    });
  });

  describe("Zero Conducted Classes Handling (No Misleading 100%)", () => {
    const refDate = new Date("2026-10-15T09:00:00Z");

    it("returns null percentage and NO_DATA badge when session list is empty", () => {
      const stats = calculateSubjectAttendance("sub-1", [], 75, refDate);

      expect(stats.conductedSessions).toBe(0);
      expect(stats.attendedSessions).toBe(0);
      expect(stats.absentSessions).toBe(0);
      expect(stats.currentPercentage).toBeNull();
      expect(stats.statusBadge).toBe("NO_DATA");
    });

    it("returns null percentage when sessions exist but none are evaluated yet", () => {
      const futureSessions: SessionWithAttendance[] = [
        {
          id: "s-1",
          subjectId: "sub-1",
          date: new Date("2026-10-16T09:00:00Z"),
          status: "SCHEDULED",
          attendanceRecord: null,
        },
        {
          id: "s-2",
          subjectId: "sub-1",
          date: new Date("2026-10-17T09:00:00Z"),
          status: "SCHEDULED",
          attendanceRecord: null,
        },
      ];

      const stats = calculateSubjectAttendance(
        "sub-1",
        futureSessions,
        75,
        refDate
      );

      expect(stats.conductedSessions).toBe(0);
      expect(stats.remainingSessions).toBe(2);
      expect(stats.currentPercentage).toBeNull();
      expect(stats.statusBadge).toBe("NO_DATA");
    });
  });

  describe("Cancelled Classes Rule", () => {
    const refDate = new Date("2026-10-20T09:00:00Z");

    it("never counts cancelled classes as conducted or attended", () => {
      const sessions: SessionWithAttendance[] = [
        // 6 Attended
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `att-${i}`,
          subjectId: "sub-1",
          date: new Date(`2026-10-0${i + 1}T09:00:00Z`),
          status: "CONDUCTED" as const,
          attendanceRecord: { status: "ATTENDED" as const },
        })),
        // 2 Absent
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `abs-${i}`,
          subjectId: "sub-1",
          date: new Date(`2026-10-0${i + 7}T09:00:00Z`),
          status: "CONDUCTED" as const,
          attendanceRecord: { status: "ABSENT" as const },
        })),
        // 2 Cancelled by college
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `can-${i}`,
          subjectId: "sub-1",
          date: new Date(`2026-10-${i + 10}T09:00:00Z`),
          status: "CANCELLED" as const,
          attendanceRecord: null,
        })),
      ];

      const stats = calculateSubjectAttendance("sub-1", sessions, 75, refDate);

      expect(stats.totalSessions).toBe(10);
      expect(stats.cancelledSessions).toBe(2);
      expect(stats.attendedSessions).toBe(6);
      expect(stats.absentSessions).toBe(2);
      // Conducted must be 6 + 2 = 8, NOT 10!
      expect(stats.conductedSessions).toBe(8);
      // Attendance percentage: 6 / 8 * 100 = 75.0%
      expect(stats.currentPercentage).toBe(75.0);
      expect(stats.statusBadge).toBe("SAFE");
    });
  });

  describe("Missing Attendance Response Rule (Pending Not Counted as Absent)", () => {
    const refDate = new Date("2026-10-15T09:00:00Z");

    it("counts unmarked past classes as pending and does not increment absences", () => {
      const sessions: SessionWithAttendance[] = [
        // 3 Attended
        {
          id: "s-1",
          subjectId: "sub-1",
          date: new Date("2026-10-10T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: { status: "ATTENDED" },
        },
        {
          id: "s-2",
          subjectId: "sub-1",
          date: new Date("2026-10-11T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: { status: "ATTENDED" },
        },
        {
          id: "s-3",
          subjectId: "sub-1",
          date: new Date("2026-10-12T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: { status: "ATTENDED" },
        },
        // 1 Absent
        {
          id: "s-4",
          subjectId: "sub-1",
          date: new Date("2026-10-13T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: { status: "ABSENT" },
        },
        // 2 Past classes without response (Student forgot to mark)
        {
          id: "s-5",
          subjectId: "sub-1",
          date: new Date("2026-10-14T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: null,
        },
        {
          id: "s-6",
          subjectId: "sub-1",
          date: new Date("2026-10-15T09:00:00Z"), // Today
          status: "SCHEDULED",
          attendanceRecord: null,
        },
      ];

      const stats = calculateSubjectAttendance("sub-1", sessions, 75, refDate);

      expect(stats.attendedSessions).toBe(3);
      expect(stats.absentSessions).toBe(1);
      // Crucial: Absent count must stay 1, not 3!
      expect(stats.pendingSessions).toBe(2);
      expect(stats.conductedSessions).toBe(4);
      // Evaluated percentage: 3 / 4 * 100 = 75.0%
      expect(stats.currentPercentage).toBe(75.0);
      expect(stats.statusBadge).toBe("SAFE");
    });
  });

  describe("Exact Boundary Tests for 75% Target", () => {
    const refDate = new Date("2026-10-30T09:00:00Z");

    const buildSessions = (attended: number, absent: number): SessionWithAttendance[] => {
      const result: SessionWithAttendance[] = [];
      for (let i = 0; i < attended; i++) {
        result.push({
          id: `att-${i}`,
          subjectId: "sub-1",
          date: new Date("2026-10-01T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: { status: "ATTENDED" },
        });
      }
      for (let i = 0; i < absent; i++) {
        result.push({
          id: `abs-${i}`,
          subjectId: "sub-1",
          date: new Date("2026-10-02T09:00:00Z"),
          status: "CONDUCTED",
          attendanceRecord: { status: "ABSENT" },
        });
      }
      return result;
    };

    it("verifies 15/20 exactly meets 75.0% target", () => {
      const stats = calculateSubjectAttendance("sub-1", buildSessions(15, 5), 75, refDate);
      expect(stats.currentPercentage).toBe(75.0);
      expect(stats.statusBadge).toBe("SAFE");
    });

    it("verifies 14/20 is 70.0% and below target", () => {
      const stats = calculateSubjectAttendance("sub-1", buildSessions(14, 6), 75, refDate);
      expect(stats.currentPercentage).toBe(70.0);
      expect(stats.statusBadge).not.toBe("SAFE");
    });

    it("verifies 3/4 exactly meets 75.0% target", () => {
      const stats = calculateSubjectAttendance("sub-1", buildSessions(3, 1), 75, refDate);
      expect(stats.currentPercentage).toBe(75.0);
      expect(stats.statusBadge).toBe("SAFE");
    });

    it("verifies 74/100 is 74.0% and fails 75% target", () => {
      const stats = calculateSubjectAttendance("sub-1", buildSessions(74, 26), 75, refDate);
      expect(stats.currentPercentage).toBe(74.0);
      expect(stats.statusBadge).not.toBe("SAFE");
    });

    it("verifies 75/100 is 75.0% and meets 75% target", () => {
      const stats = calculateSubjectAttendance("sub-1", buildSessions(75, 25), 75, refDate);
      expect(stats.currentPercentage).toBe(75.0);
      expect(stats.statusBadge).toBe("SAFE");
    });

    it("verifies 76/100 is 76.0% and meets 75% target", () => {
      const stats = calculateSubjectAttendance("sub-1", buildSessions(76, 24), 75, refDate);
      expect(stats.currentPercentage).toBe(76.0);
      expect(stats.statusBadge).toBe("SAFE");
    });
  });
});
