import { describe, expect, it } from "vitest";
import {
  calculateRecoveryClasses,
  calculateSafeBunks,
  generateBunkRecommendation,
  generateSemesterForecast,
  isMeetingTarget,
  simulateUpcomingAbsences,
} from "../../src/services/bunkPlanner.js";
import { SubjectAttendanceStats } from "../../src/types/attendance.js";

describe("BunkPlanner — Unit Tests", () => {
  describe("isMeetingTarget (Exact Integer Arithmetic)", () => {
    it("correctly identifies exact 75% boundary", () => {
      expect(isMeetingTarget(15, 20, 75)).toBe(true); // Exactly 75.0%
      expect(isMeetingTarget(14, 20, 75)).toBe(false); // 70.0%
      expect(isMeetingTarget(3, 4, 75)).toBe(true); // Exactly 75.0%
      expect(isMeetingTarget(18, 20, 75)).toBe(true); // 90.0%
    });

    it("returns false when conducted is 0", () => {
      expect(isMeetingTarget(0, 0, 75)).toBe(false);
    });

    it("handles arbitrary integer targets accurately", () => {
      expect(isMeetingTarget(8, 10, 80)).toBe(true); // Exactly 80%
      expect(isMeetingTarget(7, 10, 80)).toBe(false); // 70%
      expect(isMeetingTarget(6, 10, 60)).toBe(true); // Exactly 60%
    });
  });

  describe("calculateSafeBunks (k)", () => {
    it("returns exact integer maximum consecutive absences for 75% target", () => {
      // A=18, C=20 -> (1800 - 1500) / 75 = 300 / 75 = 4
      const k = calculateSafeBunks(18, 20, 75);
      expect(k).toBe(4);

      // Verify boundary after 4 absences: 18 / 24 = 75.0% >= 75%
      expect(isMeetingTarget(18, 20 + k, 75)).toBe(true);
      // Verify that 5th absence breaches target: 18 / 25 = 72% < 75%
      expect(isMeetingTarget(18, 20 + k + 1, 75)).toBe(false);
    });

    it("returns 0 safe bunks when exactly at 75% threshold", () => {
      // A=15, C=20 -> exactly 75%
      const k = calculateSafeBunks(15, 20, 75);
      expect(k).toBe(0);
      // 1 absence drops to 15 / 21 = 71.4%
      expect(isMeetingTarget(15, 21, 75)).toBe(false);
    });

    it("returns 1 safe bunk when A=16, C=20", () => {
      // A=16, C=20 -> (1600 - 1500) / 75 = 100 / 75 = 1
      const k = calculateSafeBunks(16, 20, 75);
      expect(k).toBe(1);
      // After 1 bunk: 16 / 21 = 76.19% >= 75%
      expect(isMeetingTarget(16, 21, 75)).toBe(true);
      // After 2 bunks: 16 / 22 = 72.7% < 75%
      expect(isMeetingTarget(16, 22, 75)).toBe(false);
    });

    it("returns 6 safe bunks when A=20, C=20 (100% current)", () => {
      // A=20, C=20 -> (2000 - 1500) / 75 = 500 / 75 = 6
      const k = calculateSafeBunks(20, 20, 75);
      expect(k).toBe(6);
      // After 6 bunks: 20 / 26 = 76.92% >= 75%
      expect(isMeetingTarget(20, 26, 75)).toBe(true);
      // After 7 bunks: 20 / 27 = 74.07% < 75%
      expect(isMeetingTarget(20, 27, 75)).toBe(false);
    });

    it("returns 0 safe bunks when attendance is below target", () => {
      expect(calculateSafeBunks(14, 20, 75)).toBe(0);
      expect(calculateSafeBunks(5, 10, 75)).toBe(0);
    });

    it("returns 0 safe bunks when conducted is 0", () => {
      expect(calculateSafeBunks(0, 0, 75)).toBe(0);
    });

    it("calculates safe bunks for alternative targets (80% and 60%)", () => {
      // A=10, C=10, Target=80 -> (1000 - 800) / 80 = 200 / 80 = 2
      const k80 = calculateSafeBunks(10, 10, 80);
      expect(k80).toBe(2);
      expect(isMeetingTarget(10, 12, 80)).toBe(true); // 10/12 = 83.3%
      expect(isMeetingTarget(10, 13, 80)).toBe(false); // 10/13 = 76.9%

      // A=8, C=10, Target=60 -> (800 - 600) / 60 = 200 / 60 = 3
      const k60 = calculateSafeBunks(8, 10, 60);
      expect(k60).toBe(3);
      expect(isMeetingTarget(8, 13, 60)).toBe(true); // 8/13 = 61.54%
      expect(isMeetingTarget(8, 14, 60)).toBe(false); // 8/14 = 57.14%
    });
  });

  describe("calculateRecoveryClasses (n)", () => {
    it("returns exact integer consecutive classes needed to restore 75%", () => {
      // A=14, C=20 -> (75 * 20 - 1400) / 25 = (1500 - 1400) / 25 = 100 / 25 = 4
      const n = calculateRecoveryClasses(14, 20, 75);
      expect(n).toBe(4);

      // Verify recovery: (14 + 4) / (20 + 4) = 18 / 24 = 75.0% >= 75%
      expect(isMeetingTarget(14 + n, 20 + n, 75)).toBe(true);
      // Verify that n-1 is insufficient: 17 / 23 = 73.91% < 75%
      expect(isMeetingTarget(14 + n - 1, 20 + n - 1, 75)).toBe(false);
    });

    it("calculates recovery when A=7, C=10, Target=75%", () => {
      // (750 - 700) / 25 = 50 / 25 = 2
      const n = calculateRecoveryClasses(7, 10, 75);
      expect(n).toBe(2);
      expect(isMeetingTarget(9, 12, 75)).toBe(true); // 9/12 = 75.0%
      expect(isMeetingTarget(8, 11, 75)).toBe(false); // 8/11 = 72.7%
    });

    it("calculates recovery when A=6, C=10, Target=75%", () => {
      // (750 - 600) / 25 = 150 / 25 = 6
      const n = calculateRecoveryClasses(6, 10, 75);
      expect(n).toBe(6);
      expect(isMeetingTarget(12, 16, 75)).toBe(true); // 12/16 = 75.0%
      expect(isMeetingTarget(11, 15, 75)).toBe(false); // 11/15 = 73.3%
    });

    it("handles non-divisible target recovery (Target=70%)", () => {
      // A=6, C=10, Target=70% -> (700 - 600) / 30 = 100 / 30 = ceil(3.333) = 4
      const n = calculateRecoveryClasses(6, 10, 70);
      expect(n).toBe(4);
      // With 4: (6 + 4) / (10 + 4) = 10 / 14 = 71.43% >= 70%
      expect(isMeetingTarget(10, 14, 70)).toBe(true);
      // With 3: (6 + 3) / (10 + 3) = 9 / 13 = 69.23% < 70%
      expect(isMeetingTarget(9, 13, 70)).toBe(false);
    });

    it("returns 0 recovery classes when already meeting target", () => {
      expect(calculateRecoveryClasses(15, 20, 75)).toBe(0);
      expect(calculateRecoveryClasses(18, 20, 75)).toBe(0);
    });

    it("returns 0 recovery classes when conducted is 0", () => {
      expect(calculateRecoveryClasses(0, 0, 75)).toBe(0);
    });
  });

  describe("generateBunkRecommendation", () => {
    const baseStats: SubjectAttendanceStats = {
      subjectId: "sub-1",
      targetPercent: 75,
      totalSessions: 30,
      conductedSessions: 20,
      attendedSessions: 18,
      absentSessions: 2,
      pendingSessions: 0,
      cancelledSessions: 0,
      remainingSessions: 10,
      currentPercentage: 90.0,
      statusBadge: "SAFE",
    };

    it("returns INSUFFICIENT_INFORMATION when 0 classes have been conducted", () => {
      const stats: SubjectAttendanceStats = {
        ...baseStats,
        conductedSessions: 0,
        attendedSessions: 0,
        absentSessions: 0,
        currentPercentage: null,
        statusBadge: "NO_DATA",
      };

      const result = generateBunkRecommendation(stats);
      expect(result.recommendationCode).toBe("INSUFFICIENT_INFORMATION");
      expect(result.safeBunks).toBe(0);
      expect(result.requiredToRecover).toBe(0);
      expect(result.currentPercentage).toBeNull();
      expect(result.disclaimer).toMatch(/Disclaimer: Projections are derived/);
    });

    it("returns SAFE_TO_SKIP with safe bunks and explanation when well above target", () => {
      const result = generateBunkRecommendation(baseStats);
      expect(result.recommendationCode).toBe("SAFE_TO_SKIP");
      expect(result.safeBunks).toBe(4);
      expect(result.isMeetingTarget).toBe(true);
      expect(result.headline).toContain("Safe to miss up to 4 classes");
      expect(result.mathematicalExplanation).toContain("remains at or above your 75% requirement");
    });

    it("returns ON_THE_EDGE when exactly meeting target with 0 buffer", () => {
      const edgeStats: SubjectAttendanceStats = {
        ...baseStats,
        attendedSessions: 15,
        absentSessions: 5,
        currentPercentage: 75.0,
      };

      const result = generateBunkRecommendation(edgeStats);
      expect(result.recommendationCode).toBe("ON_THE_EDGE");
      expect(result.safeBunks).toBe(0);
      expect(result.isMeetingTarget).toBe(true);
      expect(result.headline).toContain("Attend Upcoming Class");
      expect(result.mathematicalExplanation).toContain("below target");
    });

    it("returns ATTEND when in deficit but feasible to recover within remaining classes", () => {
      const deficitStats: SubjectAttendanceStats = {
        ...baseStats,
        attendedSessions: 14,
        absentSessions: 6,
        currentPercentage: 70.0,
        remainingSessions: 10, // 4 needed <= 10 remaining
      };

      const result = generateBunkRecommendation(deficitStats);
      expect(result.recommendationCode).toBe("ATTEND");
      expect(result.requiredToRecover).toBe(4);
      expect(result.isMeetingTarget).toBe(false);
      expect(result.headline).toContain("Attend next 4 classes to recover");
    });

    it("returns MATHEMATICALLY_IMPOSSIBLE when recovery deficit exceeds remaining schedule", () => {
      const impossibleStats: SubjectAttendanceStats = {
        ...baseStats,
        attendedSessions: 6,
        absentSessions: 4, // 6/10 = 60%, needs 6 consecutive classes to reach 75%
        conductedSessions: 10,
        currentPercentage: 60.0,
        remainingSessions: 3, // only 3 remaining < 6 needed!
      };

      const result = generateBunkRecommendation(impossibleStats);
      expect(result.recommendationCode).toBe("MATHEMATICALLY_IMPOSSIBLE");
      expect(result.requiredToRecover).toBe(6);
      expect(result.headline).toContain("Target Mathematically Unachievable on Current Schedule");
      expect(result.mathematicalExplanation).toContain("only 3 confirmed sessions remain");
    });
  });

  describe("simulateUpcomingAbsences", () => {
    it("simulates 1 absence correctly on 18/20 (90%)", () => {
      const sim = simulateUpcomingAbsences(18, 20, 75, 1);
      expect(sim.simulatedAbsences).toBe(1);
      expect(sim.currentPercentage).toBe(90.0);
      expect(sim.projectedConducted).toBe(21);
      expect(sim.projectedAttended).toBe(18);
      // 18 / 21 = 85.71%
      expect(sim.projectedPercentage).toBe(85.71);
      expect(sim.percentageChange).toBe(-4.29);
      expect(sim.willFallBelowTarget).toBe(false);
    });

    it("simulates 5 absences causing attendance to fall below 75%", () => {
      const sim = simulateUpcomingAbsences(18, 20, 75, 5);
      expect(sim.projectedConducted).toBe(25);
      expect(sim.projectedAttended).toBe(18);
      // 18 / 25 = 72.0%
      expect(sim.projectedPercentage).toBe(72.0);
      expect(sim.willFallBelowTarget).toBe(true);
    });

    it("rejects non-positive integers for simulated absences", () => {
      expect(() => simulateUpcomingAbsences(18, 20, 75, 0)).toThrow();
      expect(() => simulateUpcomingAbsences(18, 20, 75, -2)).toThrow();
      expect(() => simulateUpcomingAbsences(18, 20, 75, 1.5)).toThrow();
    });
  });

  describe("generateSemesterForecast", () => {
    it("generates 3 distinct forward-looking scenarios accurately", () => {
      const forecast = generateSemesterForecast(18, 20, 75, 10);

      // Scenario 1: Attend all 10 remaining -> 28 / 30 = 93.33%
      expect(forecast.scenarios.attendAllFuture.conductedTotal).toBe(30);
      expect(forecast.scenarios.attendAllFuture.attendedTotal).toBe(28);
      expect(forecast.scenarios.attendAllFuture.projectedPercentage).toBe(93.33);
      expect(forecast.scenarios.attendAllFuture.meetsTarget).toBe(true);

      // Scenario 2: Maintain current rate (90%) -> +9 attended out of 10 -> 27 / 30 = 90.0%
      expect(forecast.scenarios.maintainCurrentRate.conductedTotal).toBe(30);
      expect(forecast.scenarios.maintainCurrentRate.attendedTotal).toBe(27);
      expect(forecast.scenarios.maintainCurrentRate.projectedPercentage).toBe(90.0);
      expect(forecast.scenarios.maintainCurrentRate.meetsTarget).toBe(true);

      // Scenario 3: Miss max safe bunks (4) -> 18 / 24 = 75.0%
      expect(forecast.scenarios.missMaxSafeBunks.bunksUsed).toBe(4);
      expect(forecast.scenarios.missMaxSafeBunks.conductedTotal).toBe(24);
      expect(forecast.scenarios.missMaxSafeBunks.attendedTotal).toBe(18);
      expect(forecast.scenarios.missMaxSafeBunks.projectedPercentage).toBe(75.0);
      expect(forecast.scenarios.missMaxSafeBunks.meetsTarget).toBe(true);

      expect(forecast.disclaimer).toMatch(/Disclaimer: Projections are derived/);
    });
  });
});
