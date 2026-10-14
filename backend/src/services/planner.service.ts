import { AppError } from "../middleware/error.middleware.js";
import {
  ForecastQuery,
  SimulateAttendanceInput,
} from "../schemas/planner.schema.js";
import { getAuthorizedSubject } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";
import { getSubjectSummary } from "./attendance.service.js";
import {
  calculateRecoveryClasses,
  calculateSafeBunks,
  isMeetingTarget,
} from "./bunkPlanner.js";
import { getCurrentSemester } from "./semester.service.js";

const INSTITUTIONAL_DISCLAIMER =
  "Disclaimer: Projections are derived from integer-safe mathematical models based on your scheduled timetable sessions. " +
  "These estimates do not guarantee institutional eligibility or compliance with specific departmental policies, " +
  "such as minimum attendance thresholds per component (lectures vs. labs), faculty condonation rules, or unscheduled make-up classes.";

/**
 * Returns smart bunk metrics for all subjects in the selected semester.
 */
export const getSemesterPlannerSubjects = async (
  userId: string,
  semesterId?: string
) => {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (!current) {
      const error: AppError = new Error(
        "No active semester found. Create a semester before accessing the bunk planner."
      );
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = current.id;
  }

  const subjects = await prisma.subject.findMany({
    where: {
      semesterId: targetSemesterId,
      semester: { userId },
    },
    orderBy: { name: "asc" },
  });

  const subjectMetrics = await Promise.all(
    subjects.map(async (sub) => {
      const summary = await getSubjectSummary(sub.id, userId);
      const isRecoveryPossible =
        summary.isMeetingTarget || summary.requiredToRecover <= summary.remainingSessions;

      return {
        ...summary,
        isRecoveryPossible,
      };
    })
  );

  return {
    semesterId: targetSemesterId,
    subjects: subjectMetrics,
    disclaimer: INSTITUTIONAL_DISCLAIMER,
  };
};

/**
 * What-If Attendance Simulator:
 * Allows a student to simulate attending or missing specific future sessions.
 * Guarantees:
 * 1. Pure in-memory calculation — DOES NOT modify database rows.
 * 2. Rejects duplicate session IDs.
 * 3. Rejects already evaluated or conducted sessions.
 * 4. Rejects cancelled sessions.
 * 5. Rejects sessions belonging to another user or outside the selected subject/semester.
 */
export const simulateAttendanceScenario = async (
  userId: string,
  input: SimulateAttendanceInput
) => {
  const subject = await getAuthorizedSubject(input.subjectId, userId);

  // 1. Reject duplicate session IDs in the simulation payload
  const sessionIds = input.simulatedSessions.map((s) => s.sessionId);
  if (new Set(sessionIds).size !== sessionIds.length) {
    const error: AppError = new Error(
      "Duplicate session IDs detected in simulation scenario. Each session may only be simulated once."
    );
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch all requested sessions from database
  const sessions = await prisma.classSession.findMany({
    where: {
      id: { in: sessionIds },
      subjectId: subject.id,
      semester: { userId },
    },
    include: {
      attendanceRecord: true,
    },
  });

  if (sessions.length !== sessionIds.length) {
    const error: AppError = new Error(
      "One or more session IDs are invalid, do not belong to this subject, or are not owned by your account."
    );
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate eligibility: only unconducted, non-cancelled sessions can be simulated
  for (const session of sessions) {
    if (session.status === "CANCELLED") {
      const error: AppError = new Error(
        `Session on ${session.date.toISOString().slice(0, 10)} is cancelled and cannot be simulated.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (session.status === "CONDUCTED" || session.attendanceRecord) {
      const error: AppError = new Error(
        `Session on ${session.date.toISOString().slice(0, 10)} has already been conducted/evaluated and cannot be simulated.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 4. Retrieve current subject baseline attendance
  const baseline = await getSubjectSummary(subject.id, userId);

  let simAttendedCount = 0;
  let simMissedCount = 0;

  for (const item of input.simulatedSessions) {
    if (item.action === "ATTEND") simAttendedCount++;
    if (item.action === "MISS") simMissedCount++;
  }

  const projectedAttended = baseline.attendedSessions + simAttendedCount;
  const projectedConducted =
    baseline.conductedSessions + simAttendedCount + simMissedCount;

  let projectedPercentage: number | null = null;
  if (projectedConducted > 0) {
    projectedPercentage =
      Math.round((projectedAttended / projectedConducted) * 10000) / 100;
  }

  const percentageChange =
    projectedPercentage !== null && baseline.currentPercentage !== null
      ? Math.round((projectedPercentage - baseline.currentPercentage) * 100) / 100
      : null;

  const targetPercent = baseline.targetPercent;
  const willMeetTarget = isMeetingTarget(
    projectedAttended,
    projectedConducted,
    targetPercent
  );

  const projectedSafeBunks = calculateSafeBunks(
    projectedAttended,
    projectedConducted,
    targetPercent
  );

  const projectedRecoveryNeeded = calculateRecoveryClasses(
    projectedAttended,
    projectedConducted,
    targetPercent
  );

  const remainingSessionsAfterSim = Math.max(
    0,
    baseline.remainingSessions - input.simulatedSessions.length
  );

  const isRecoveryFeasibleAfterSim =
    willMeetTarget || projectedRecoveryNeeded <= remainingSessionsAfterSim;

  let explanation: string;
  if (willMeetTarget) {
    explanation =
      `After simulating ${simAttendedCount} attended and ${simMissedCount} missed class(es), ` +
      `projected attendance becomes ${projectedAttended}/${projectedConducted} (${projectedPercentage?.toFixed(2)}%), ` +
      `which MEETS your target of ${targetPercent}%. You will have ${projectedSafeBunks} safe bunk(s) remaining.`;
  } else {
    explanation =
      `After simulating ${simAttendedCount} attended and ${simMissedCount} missed class(es), ` +
      `projected attendance drops to ${projectedAttended}/${projectedConducted} (${projectedPercentage?.toFixed(2)}%), ` +
      `which FALLS BELOW your target of ${targetPercent}%. You will need to attend ${projectedRecoveryNeeded} consecutive classes to recover ` +
      `(${remainingSessionsAfterSim} eligible classes remain in the semester schedule).`;
  }

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code,
    targetPercent,
    currentMetrics: {
      attendedSessions: baseline.attendedSessions,
      conductedSessions: baseline.conductedSessions,
      currentPercentage: baseline.currentPercentage,
      isMeetingTarget: baseline.isMeetingTarget,
      safeBunks: baseline.safeBunks,
      requiredToRecover: baseline.requiredToRecover,
    },
    simulatedChanges: {
      totalSimulated: input.simulatedSessions.length,
      simulatedAttended: simAttendedCount,
      simulatedMissed: simMissedCount,
    },
    projectedMetrics: {
      projectedAttended,
      projectedConducted,
      projectedPercentage,
      percentageChange,
      willMeetTarget,
      projectedSafeBunks,
      projectedRecoveryNeeded,
      remainingSessionsAfterSim,
      isRecoveryFeasibleAfterSim,
    },
    explanation,
    disclaimer: INSTITUTIONAL_DISCLAIMER,
  };
};

/**
 * Generates forward-looking semester forecasts for each subject.
 */
export const getSemesterForecasts = async (
  userId: string,
  query: ForecastQuery
) => {
  let targetSemesterId = query.semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (!current) {
      const error: AppError = new Error("No active semester found.");
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = current.id;
  }

  const subjects = await prisma.subject.findMany({
    where: {
      semesterId: targetSemesterId,
      semester: { userId },
    },
    orderBy: { name: "asc" },
  });

  const subjectForecasts = await Promise.all(
    subjects.map(async (sub) => {
      const baseline = await getSubjectSummary(sub.id, userId);
      const target = baseline.targetPercent;
      const R = baseline.remainingSessions;
      const A = baseline.attendedSessions;
      const C = baseline.conductedSessions;

      // Scenario 1: Attend 100% of remaining scheduled sessions
      const attendAllA = A + R;
      const attendAllC = C + R;
      const attendAllPct =
        attendAllC > 0 ? Math.round((attendAllA / attendAllC) * 10000) / 100 : null;
      const attendAllMeetsTarget = isMeetingTarget(attendAllA, attendAllC, target);

      // Scenario 2: Miss 100% of remaining scheduled sessions
      const missAllA = A;
      const missAllC = C + R;
      const missAllPct =
        missAllC > 0 ? Math.round((missAllA / missAllC) * 10000) / 100 : null;
      const missAllMeetsTarget = isMeetingTarget(missAllA, missAllC, target);

      // Scenario 3: Maintain current attendance trajectory
      let maintainPct: number | null = null;
      let maintainA = A;
      const maintainC = C + R;
      if (C > 0) {
        const rate = A / C;
        const addA = Math.round(R * rate);
        maintainA = A + addA;
        maintainPct =
          maintainC > 0 ? Math.round((maintainA / maintainC) * 10000) / 100 : null;
      }
      const maintainMeetsTarget = isMeetingTarget(maintainA, maintainC, target);

      // Scenario 4: Custom trajectory (if configured)
      let customScenario: any = null;
      if (query.customAttendanceRate !== undefined) {
        const customRateFrac = query.customAttendanceRate / 100;
        const customAddA = Math.round(R * customRateFrac);
        const customA = A + customAddA;
        const customC = C + R;
        const customPct =
          customC > 0 ? Math.round((customA / customC) * 10000) / 100 : null;
        customScenario = {
          rateUsedPercent: query.customAttendanceRate,
          projectedAttended: customA,
          projectedConducted: customC,
          projectedPercentage: customPct,
          meetsTarget: isMeetingTarget(customA, customC, target),
        };
      }

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        color: sub.color,
        targetPercent: target,
        currentMetrics: {
          attendedSessions: A,
          conductedSessions: C,
          currentPercentage: baseline.currentPercentage,
          remainingSessions: R,
        },
        scenarios: {
          attendAllRemaining: {
            projectedAttended: attendAllA,
            projectedConducted: attendAllC,
            projectedPercentage: attendAllPct,
            meetsTarget: attendAllMeetsTarget,
          },
          missAllRemaining: {
            projectedAttended: missAllA,
            projectedConducted: missAllC,
            projectedPercentage: missAllPct,
            meetsTarget: missAllMeetsTarget,
          },
          maintainCurrentRate: {
            projectedAttended: maintainA,
            projectedConducted: maintainC,
            projectedPercentage: maintainPct,
            meetsTarget: maintainMeetsTarget,
          },
          ...(customScenario ? { customRateScenario: customScenario } : {}),
        },
      };
    })
  );

  return {
    semesterId: targetSemesterId,
    subjects: subjectForecasts,
    disclaimer: INSTITUTIONAL_DISCLAIMER,
  };
};

/**
 * Dedicated Deficit Recovery Planner:
 * Identifies all subjects below target attendance and computes exact consecutive attendance needed.
 * Checks feasibility against remaining schedule and flags impossible targets with exact shortfall.
 */
export const getRecoveryPlan = async (
  userId: string,
  semesterId?: string
) => {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (!current) {
      const error: AppError = new Error("No active semester found.");
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = current.id;
  }

  const subjects = await prisma.subject.findMany({
    where: {
      semesterId: targetSemesterId,
      semester: { userId },
    },
    orderBy: { name: "asc" },
  });

  const deficitSubjects: any[] = [];

  for (const sub of subjects) {
    const baseline = await getSubjectSummary(sub.id, userId);

    // Only include subjects with conducted classes that are currently below target
    if (baseline.conductedSessions > 0 && !baseline.isMeetingTarget) {
      const n = baseline.requiredToRecover;
      const R = baseline.remainingSessions;
      const isAchievable = n <= R;
      const shortfall = isAchievable ? 0 : n - R;

      // Best possible attendance if student attends 100% of remaining classes
      const bestAttended = baseline.attendedSessions + R;
      const bestConducted = baseline.conductedSessions + R;
      const maxAchievablePercentage =
        bestConducted > 0
          ? Math.round((bestAttended / bestConducted) * 10000) / 100
          : 0;

      deficitSubjects.push({
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        color: sub.color,
        targetPercent: baseline.targetPercent,
        currentPercentage: baseline.currentPercentage,
        attendedSessions: baseline.attendedSessions,
        conductedSessions: baseline.conductedSessions,
        remainingSessions: R,
        recoveryClassesNeeded: n,
        isAchievable,
        shortfall,
        maxAchievablePercentage,
        recommendationCode: isAchievable ? "ATTEND" : "MATHEMATICALLY_IMPOSSIBLE",
        headline: isAchievable
          ? `Attend next ${n} consecutive class${n > 1 ? "es" : ""} to regain eligibility`
          : `Deficit exceeds remaining schedule (Shortfall: ${shortfall} class${shortfall > 1 ? "es" : ""})`,
        actionPlan: isAchievable
          ? `Attending ${n} consecutive classes elevates your record to ${baseline.attendedSessions + n}/${baseline.conductedSessions + n} (meets target).`
          : `Attending all ${R} remaining classes yields a maximum of ${maxAchievablePercentage.toFixed(2)}%, which is below ${baseline.targetPercent}%. You need ${shortfall} extra/remedial classes or formal institutional condonation.`,
      });
    }
  }

  return {
    semesterId: targetSemesterId,
    totalDeficitSubjectsCount: deficitSubjects.length,
    deficitSubjects,
    disclaimer: INSTITUTIONAL_DISCLAIMER,
  };
};
