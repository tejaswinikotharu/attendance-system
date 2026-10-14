import {
  BunkPlannerResult,
  SemesterForecast,
  SimulationResult,
  SubjectAttendanceStats,
} from "../types/attendance.js";
import { validateTargetPercent } from "./attendanceEngine.js";

const INSTITUTIONAL_DISCLAIMER =
  "Disclaimer: Projections are derived from integer-safe mathematical models based on your scheduled timetable sessions. " +
  "These estimates do not guarantee institutional eligibility or compliance with specific departmental policies, " +
  "such as minimum attendance thresholds per component (lectures vs. labs), faculty condonation rules, or unscheduled make-up classes.";

/**
 * Evaluates whether current attendance strictly meets or exceeds the target.
 * Uses exact integer cross-multiplication (A * 100 >= T * C) to prevent floating-point inaccuracy.
 */
export function isMeetingTarget(
  attended: number,
  conducted: number,
  rawTargetPercent: number
): boolean {
  const targetPercent = validateTargetPercent(rawTargetPercent);
  if (conducted <= 0) return false;
  return attended * 100 >= targetPercent * conducted;
}

/**
 * Calculates the maximum consecutive upcoming classes (k) that can be missed
 * without intervening attendance while retaining >= targetPercent.
 *
 * Mathematical derivation:
 * (A) / (C + k) >= T / 100
 * 100 * A >= T * (C + k)
 * T * k <= 100 * A - T * C
 * k = floor((100 * A - T * C) / T)
 */
export function calculateSafeBunks(
  attended: number,
  conducted: number,
  rawTargetPercent: number
): number {
  const targetPercent = validateTargetPercent(rawTargetPercent);
  if (conducted <= 0) return 0;
  if (!isMeetingTarget(attended, conducted, targetPercent)) return 0;

  const numerator = 100 * attended - targetPercent * conducted;
  const k = Math.floor(numerator / targetPercent);
  return Math.max(0, k);
}

/**
 * Calculates the minimum consecutive upcoming classes (n) that must be attended
 * without missing any class to recover attendance to >= targetPercent.
 *
 * Mathematical derivation:
 * (A + n) / (C + n) >= T / 100
 * 100 * (A + n) >= T * (C + n)
 * 100 * A + 100 * n >= T * C + T * n
 * (100 - T) * n >= T * C - 100 * A
 * n = ceil((T * C - 100 * A) / (100 - T))
 */
export function calculateRecoveryClasses(
  attended: number,
  conducted: number,
  rawTargetPercent: number
): number {
  const targetPercent = validateTargetPercent(rawTargetPercent);
  if (conducted <= 0) return 0;
  if (isMeetingTarget(attended, conducted, targetPercent)) return 0;

  const numerator = targetPercent * conducted - 100 * attended;
  const denominator = 100 - targetPercent;
  const n = Math.ceil(numerator / denominator);
  return Math.max(1, n);
}

/**
 * Simulates the exact impact of missing a specific number of upcoming classes.
 */
export function simulateUpcomingAbsences(
  attended: number,
  conducted: number,
  rawTargetPercent: number,
  absencesCount: number = 1
): SimulationResult {
  const targetPercent = validateTargetPercent(rawTargetPercent);

  if (absencesCount < 1 || !Number.isInteger(absencesCount)) {
    throw new Error("Absences count to simulate must be a positive integer.");
  }

  const currentPercentage =
    conducted > 0 ? Math.round((attended / conducted) * 10000) / 100 : null;

  const projectedConducted = conducted + absencesCount;
  const projectedAttended = attended;
  const projectedPercentage =
    Math.round((projectedAttended / projectedConducted) * 10000) / 100;

  const percentageChange =
    currentPercentage !== null
      ? Math.round((projectedPercentage - currentPercentage) * 100) / 100
      : 0;

  const willFallBelowTarget =
    projectedAttended * 100 < targetPercent * projectedConducted;

  const explanation =
    `Simulating ${absencesCount} absence(s): Conducted increases from ${conducted} to ${projectedConducted}, ` +
    `attended remains ${attended}. Projected attendance drops to ${projectedPercentage.toFixed(2)}% ` +
    `(${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(2)}%), which ` +
    `${willFallBelowTarget ? "FALLS BELOW" : "remains AT OR ABOVE"} your target of ${targetPercent}%.`;

  return {
    simulatedAbsences: absencesCount,
    currentPercentage,
    projectedConducted,
    projectedAttended,
    projectedPercentage,
    percentageChange,
    willFallBelowTarget,
    explanation,
  };
}

/**
 * Generates an actionable bunk planner recommendation with detailed mathematical reasoning.
 */
export function generateBunkRecommendation(
  stats: SubjectAttendanceStats
): BunkPlannerResult {
  const {
    conductedSessions,
    attendedSessions,
    absentSessions,
    remainingSessions,
    targetPercent,
    currentPercentage,
  } = stats;

  // Case 1: Zero conducted classes
  if (conductedSessions === 0) {
    return {
      targetPercent,
      conductedSessions: 0,
      attendedSessions: 0,
      absentSessions: 0,
      remainingSessions,
      currentPercentage: null,
      isMeetingTarget: false,
      safeBunks: 0,
      requiredToRecover: 0,
      recommendationCode: "INSUFFICIENT_INFORMATION",
      headline: "No Attendance History",
      mathematicalExplanation:
        "No completed classes have been evaluated yet for this subject. " +
        "Bunk calculations and safe thresholds will become active once the first class is conducted and marked.",
      disclaimer: INSTITUTIONAL_DISCLAIMER,
    };
  }

  const meetingTarget = isMeetingTarget(
    attendedSessions,
    conductedSessions,
    targetPercent
  );

  // Case 2: Above or at target
  if (meetingTarget) {
    const safeBunks = calculateSafeBunks(
      attendedSessions,
      conductedSessions,
      targetPercent
    );

    if (safeBunks > 0) {
      const projectedAfterBunk =
        Math.round(
          (attendedSessions / (conductedSessions + safeBunks)) * 10000
        ) / 100;

      return {
        targetPercent,
        conductedSessions,
        attendedSessions,
        absentSessions,
        remainingSessions,
        currentPercentage,
        isMeetingTarget: true,
        safeBunks,
        requiredToRecover: 0,
        recommendationCode: "SAFE_TO_SKIP",
        headline: `Safe to miss up to ${safeBunks} class${safeBunks > 1 ? "es" : ""}`,
        mathematicalExplanation:
          `You have attended ${attendedSessions} of ${conductedSessions} conducted classes (${currentPercentage?.toFixed(2)}%). ` +
          `Missing up to ${safeBunks} consecutive upcoming class(es) results in ${attendedSessions}/${conductedSessions + safeBunks} ` +
          `(${projectedAfterBunk.toFixed(2)}%), which remains at or above your ${targetPercent}% requirement.`,
        disclaimer: INSTITUTIONAL_DISCLAIMER,
      };
    }

    // Boundary case: exactly meeting target, cannot bunk any
    const dropAfterOne =
      Math.round((attendedSessions / (conductedSessions + 1)) * 10000) / 100;

    return {
      targetPercent,
      conductedSessions,
      attendedSessions,
      absentSessions,
      remainingSessions,
      currentPercentage,
      isMeetingTarget: true,
      safeBunks: 0,
      requiredToRecover: 0,
      recommendationCode: "ON_THE_EDGE",
      headline: "Attend Upcoming Class (Threshold Boundary)",
      mathematicalExplanation:
        `Your attendance of ${currentPercentage?.toFixed(2)}% currently meets your ${targetPercent}% target, ` +
        `but you have 0 buffer bunks. Missing even 1 upcoming class drops your attendance to ${dropAfterOne.toFixed(2)}%, below target.`,
      disclaimer: INSTITUTIONAL_DISCLAIMER,
    };
  }

  // Case 3: In deficit (below target)
  const requiredToRecover = calculateRecoveryClasses(
    attendedSessions,
    conductedSessions,
    targetPercent
  );

  const projectedAfterRecovery =
    Math.round(
      ((attendedSessions + requiredToRecover) /
        (conductedSessions + requiredToRecover)) *
        10000
    ) / 100;

  // Check feasibility against confirmed remaining schedule
  if (remainingSessions > 0 && requiredToRecover > remainingSessions) {
    const maxPossibleAttended = attendedSessions + remainingSessions;
    const maxPossibleConducted = conductedSessions + remainingSessions;
    const maxPossiblePercent =
      Math.round((maxPossibleAttended / maxPossibleConducted) * 10000) / 100;

    return {
      targetPercent,
      conductedSessions,
      attendedSessions,
      absentSessions,
      remainingSessions,
      currentPercentage,
      isMeetingTarget: false,
      safeBunks: 0,
      requiredToRecover,
      recommendationCode: "MATHEMATICALLY_IMPOSSIBLE",
      headline: "Target Mathematically Unachievable on Current Schedule",
      mathematicalExplanation:
        `Recovering to ${targetPercent}% requires attending ${requiredToRecover} consecutive classes, ` +
        `but only ${remainingSessions} confirmed sessions remain in the semester schedule. ` +
        `Even if you attend 100% of remaining classes, your maximum achievable attendance is ${maxPossiblePercent.toFixed(2)}%. ` +
        `Consult your instructor regarding extra sessions or formal institutional leave procedures.`,
      disclaimer: INSTITUTIONAL_DISCLAIMER,
    };
  }

  return {
    targetPercent,
    conductedSessions,
    attendedSessions,
    absentSessions,
    remainingSessions,
    currentPercentage,
    isMeetingTarget: false,
    safeBunks: 0,
    requiredToRecover,
    recommendationCode: "ATTEND",
    headline: `Attend next ${requiredToRecover} class${requiredToRecover > 1 ? "es" : ""} to recover`,
    mathematicalExplanation:
      `Current attendance is ${currentPercentage?.toFixed(2)}% (${attendedSessions}/${conductedSessions}), which is below ${targetPercent}%. ` +
      `Attending the next ${requiredToRecover} consecutive class(es) will elevate your record to ` +
      `${attendedSessions + requiredToRecover}/${conductedSessions + requiredToRecover} (${projectedAfterRecovery.toFixed(2)}%), restoring target eligibility.`,
    disclaimer: INSTITUTIONAL_DISCLAIMER,
  };
}

/**
 * Forecasts end-of-semester attendance outcomes across multiple operational scenarios.
 */
export function generateSemesterForecast(
  attended: number,
  conducted: number,
  rawTargetPercent: number,
  remainingSessions: number
): SemesterForecast {
  const targetPercent = validateTargetPercent(rawTargetPercent);
  const currentPercentage =
    conducted > 0 ? Math.round((attended / conducted) * 10000) / 100 : null;

  // Scenario 1: Attend 100% of remaining scheduled sessions
  const attendAllConducted = conducted + remainingSessions;
  const attendAllAttended = attended + remainingSessions;
  const attendAllPercent =
    attendAllConducted > 0
      ? Math.round((attendAllAttended / attendAllConducted) * 10000) / 100
      : 0;

  // Scenario 2: Maintain current attendance trajectory
  let maintainPercent: number | null = null;
  let maintainAttended = attended;
  const maintainConducted = conducted + remainingSessions;
  if (conducted > 0) {
    const currentRate = attended / conducted;
    const additionalAttended = Math.round(remainingSessions * currentRate);
    maintainAttended = attended + additionalAttended;
    maintainPercent =
      maintainConducted > 0
        ? Math.round((maintainAttended / maintainConducted) * 10000) / 100
        : null;
  }

  // Scenario 3: Miss maximum safe bunks
  const safeBunks = calculateSafeBunks(attended, conducted, targetPercent);
  const bunksToUse = Math.min(safeBunks, remainingSessions);
  const missBunksConducted = conducted + bunksToUse;
  const missBunksAttended = attended;
  const missBunksPercent =
    missBunksConducted > 0
      ? Math.round((missBunksAttended / missBunksConducted) * 10000) / 100
      : 0;

  return {
    targetPercent,
    currentConducted: conducted,
    currentAttended: attended,
    currentPercentage,
    remainingSessions,
    scenarios: {
      attendAllFuture: {
        projectedPercentage: attendAllPercent,
        conductedTotal: attendAllConducted,
        attendedTotal: attendAllAttended,
        meetsTarget: attendAllAttended * 100 >= targetPercent * attendAllConducted,
      },
      maintainCurrentRate: {
        projectedPercentage: maintainPercent,
        conductedTotal: maintainConducted,
        attendedTotal: maintainAttended,
        meetsTarget:
          maintainPercent !== null &&
          maintainAttended * 100 >= targetPercent * maintainConducted,
      },
      missMaxSafeBunks: {
        projectedPercentage: missBunksPercent,
        conductedTotal: missBunksConducted,
        attendedTotal: missBunksAttended,
        bunksUsed: bunksToUse,
        meetsTarget:
          missBunksAttended * 100 >= targetPercent * missBunksConducted,
      },
    },
    disclaimer: INSTITUTIONAL_DISCLAIMER,
  };
}
