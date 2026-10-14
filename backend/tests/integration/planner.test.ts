import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/utils/db.js";

describe("Phase 5: Smart Bunk Planner API & Semester Forecast Engine", () => {
  const userA = {
    email: `planner_user_a_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Planner Student A",
  };

  const userB = {
    email: `planner_user_b_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Planner Student B",
  };

  let tokenA: string;
  let userAId: string;
  let tokenB: string;
  let userBId: string;

  let semesterAId: string;

  // Subjects for User A
  let subSafeId: string; // 18/20 = 90%
  let subEdgeId: string; // 15/20 = 75%
  let subDeficitId: string; // 14/20 = 70% (needs 4, has 10 remaining -> feasible)
  let subImpossibleId: string; // 6/10 = 60% (needs 6, has 2 remaining -> impossible)
  let subZeroId: string; // 0/0 = unrated

  // Future sessions to simulate
  let futureSession1Id: string;
  let futureSession2Id: string;
  let evaluatedSessionId: string;
  let cancelledSessionId: string;

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post("/api/auth/register").send(userA);
    expect(resA.status).toBe(201);
    tokenA = resA.body.token;
    userAId = resA.body.user.id;

    // 2. Register User B
    const resB = await request(app).post("/api/auth/register").send(userB);
    expect(resB.status).toBe(201);
    tokenB = resB.body.token;
    userBId = resB.body.user.id;

    // 3. Create active Semester for User A
    const semRes = await request(app)
      .post("/api/semesters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Planner Test Semester",
        startDate: "2026-08-01",
        endDate: "2026-12-31",
        targetPercent: 75,
        isCurrent: true,
      });
    expect(semRes.status).toBe(201);
    semesterAId = semRes.body.semester.id;

    // 4. Seed Subject 1: Safe buffer (CS101, 18/20 = 90%, 10 remaining)
    const s1 = await prisma.subject.create({
      data: {
        semesterId: semesterAId,
        name: "Algorithms",
        code: "CS101",
        targetPercent: 75,
      },
    });
    subSafeId = s1.id;

    for (let i = 0; i < 20; i++) {
      const isAttended = i < 18;
      const sess = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subSafeId,
          date: new Date(`2026-08-${String(i + 1).padStart(2, "0")}`),
          startTime: "09:00",
          endTime: "10:00",
          status: "CONDUCTED",
        },
      });
      await prisma.attendanceRecord.create({
        data: {
          sessionId: sess.id,
          status: isAttended ? "ATTENDED" : "ABSENT",
        },
      });
      if (i === 0) evaluatedSessionId = sess.id;
    }

    // 10 Future sessions for CS101
    for (let i = 0; i < 10; i++) {
      const sess = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subSafeId,
          date: new Date(`2026-12-${String(i + 1).padStart(2, "0")}`),
          startTime: "09:00",
          endTime: "10:00",
          status: "SCHEDULED",
        },
      });
      if (i === 0) futureSession1Id = sess.id;
      if (i === 1) futureSession2Id = sess.id;
    }

    // 1 Cancelled session for CS101
    const canc = await prisma.classSession.create({
      data: {
        semesterId: semesterAId,
        subjectId: subSafeId,
        date: new Date("2026-12-25"),
        startTime: "09:00",
        endTime: "10:00",
        status: "CANCELLED",
      },
    });
    cancelledSessionId = canc.id;

    // 5. Seed Subject 2: On the Edge (CS102, 15/20 = 75%, 5 remaining)
    const s2 = await prisma.subject.create({
      data: {
        semesterId: semesterAId,
        name: "Data Structures",
        code: "CS102",
        targetPercent: 75,
      },
    });
    subEdgeId = s2.id;

    for (let i = 0; i < 20; i++) {
      const isAttended = i < 15;
      const sess = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subEdgeId,
          date: new Date(`2026-08-${String(i + 1).padStart(2, "0")}`),
          startTime: "10:00",
          endTime: "11:00",
          status: "CONDUCTED",
        },
      });
      await prisma.attendanceRecord.create({
        data: {
          sessionId: sess.id,
          status: isAttended ? "ATTENDED" : "ABSENT",
        },
      });
    }

    // 6. Seed Subject 3: Feasible Deficit (CS103, 14/20 = 70%, needs 4, 10 remaining)
    const s3 = await prisma.subject.create({
      data: {
        semesterId: semesterAId,
        name: "Database Systems",
        code: "CS103",
        targetPercent: 75,
      },
    });
    subDeficitId = s3.id;

    for (let i = 0; i < 20; i++) {
      const isAttended = i < 14;
      const sess = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subDeficitId,
          date: new Date(`2026-08-${String(i + 1).padStart(2, "0")}`),
          startTime: "11:00",
          endTime: "12:00",
          status: "CONDUCTED",
        },
      });
      await prisma.attendanceRecord.create({
        data: {
          sessionId: sess.id,
          status: isAttended ? "ATTENDED" : "ABSENT",
        },
      });
    }
    for (let i = 0; i < 10; i++) {
      await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subDeficitId,
          date: new Date(`2026-12-${String(i + 1).padStart(2, "0")}`),
          startTime: "11:00",
          endTime: "12:00",
          status: "SCHEDULED",
        },
      });
    }

    // 7. Seed Subject 4: Critical Impossible Deficit (CS104, 6/10 = 60%, needs 6, only 2 remaining)
    const s4 = await prisma.subject.create({
      data: {
        semesterId: semesterAId,
        name: "Compiler Design",
        code: "CS104",
        targetPercent: 75,
      },
    });
    subImpossibleId = s4.id;

    for (let i = 0; i < 10; i++) {
      const isAttended = i < 6;
      const sess = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subImpossibleId,
          date: new Date(`2026-09-${String(i + 1).padStart(2, "0")}`),
          startTime: "13:00",
          endTime: "14:00",
          status: "CONDUCTED",
        },
      });
      await prisma.attendanceRecord.create({
        data: {
          sessionId: sess.id,
          status: isAttended ? "ATTENDED" : "ABSENT",
        },
      });
    }
    for (let i = 0; i < 2; i++) {
      await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subImpossibleId,
          date: new Date(`2026-12-${String(i + 1).padStart(2, "0")}`),
          startTime: "13:00",
          endTime: "14:00",
          status: "SCHEDULED",
        },
      });
    }

    // 8. Seed Subject 5: Zero Conducted Classes (CS105, 0/0, 5 remaining)
    const s5 = await prisma.subject.create({
      data: {
        semesterId: semesterAId,
        name: "Machine Learning",
        code: "CS105",
        targetPercent: 75,
      },
    });
    subZeroId = s5.id;

    for (let i = 0; i < 5; i++) {
      await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subZeroId,
          date: new Date(`2026-12-${String(i + 1).padStart(2, "0")}`),
          startTime: "14:00",
          endTime: "15:00",
          status: "SCHEDULED",
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: { in: [userAId, userBId] },
      },
    });
    await prisma.$disconnect();
  });

  describe("1. Smart Bunk Planner Endpoint (GET /api/planner/subjects)", () => {
    it("returns accurate bunk metrics across all subjects in the semester", async () => {
      const res = await request(app)
        .get(`/api/planner/subjects?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.semesterId).toBe(semesterAId);
      expect(Array.isArray(res.body.subjects)).toBe(true);
      expect(res.body.disclaimer).toMatch(/Disclaimer: Projections are derived/);

      const subjects = res.body.subjects;

      // Safe subject (18/20 = 90%)
      const safeSub = subjects.find((s: any) => s.subjectId === subSafeId);
      expect(safeSub).toBeDefined();
      expect(safeSub.currentPercentage).toBe(90.0);
      expect(safeSub.isMeetingTarget).toBe(true);
      expect(safeSub.safeBunks).toBe(4);
      expect(safeSub.requiredToRecover).toBe(0);
      expect(safeSub.recommendationCode).toBe("SAFE_TO_SKIP");
      expect(safeSub.isRecoveryPossible).toBe(true);

      // Edge subject (15/20 = 75%)
      const edgeSub = subjects.find((s: any) => s.subjectId === subEdgeId);
      expect(edgeSub).toBeDefined();
      expect(edgeSub.currentPercentage).toBe(75.0);
      expect(edgeSub.isMeetingTarget).toBe(true);
      expect(edgeSub.safeBunks).toBe(0);
      expect(edgeSub.recommendationCode).toBe("ON_THE_EDGE");

      // Feasible Deficit subject (14/20 = 70%, needs 4, 10 remaining)
      const defSub = subjects.find((s: any) => s.subjectId === subDeficitId);
      expect(defSub).toBeDefined();
      expect(defSub.currentPercentage).toBe(70.0);
      expect(defSub.isMeetingTarget).toBe(false);
      expect(defSub.safeBunks).toBe(0);
      expect(defSub.requiredToRecover).toBe(4);
      expect(defSub.remainingSessions).toBe(10);
      expect(defSub.recommendationCode).toBe("ATTEND");
      expect(defSub.isRecoveryPossible).toBe(true);

      // Impossible Deficit subject (6/10 = 60%, needs 6, only 2 remaining)
      const impSub = subjects.find((s: any) => s.subjectId === subImpossibleId);
      expect(impSub).toBeDefined();
      expect(impSub.currentPercentage).toBe(60.0);
      expect(impSub.isMeetingTarget).toBe(false);
      expect(impSub.requiredToRecover).toBe(6);
      expect(impSub.remainingSessions).toBe(2);
      expect(impSub.recommendationCode).toBe("MATHEMATICALLY_IMPOSSIBLE");
      expect(impSub.isRecoveryPossible).toBe(false);

      // Zero evaluated subject (0 conducted)
      const zeroSub = subjects.find((s: any) => s.subjectId === subZeroId);
      expect(zeroSub).toBeDefined();
      expect(zeroSub.conductedSessions).toBe(0);
      expect(zeroSub.currentPercentage).toBeNull();
      expect(zeroSub.recommendationCode).toBe("INSUFFICIENT_INFORMATION");
      expect(zeroSub.statusBadge).toBe("NO_DATA");
    });
  });

  describe("2. What-If Attendance Simulator (POST /api/planner/simulate)", () => {
    it("simulates attending 1 session and missing 1 session without changing database records", async () => {
      // Baseline CS101: 18/20 = 90%
      // Simulate Session 1 (ATTEND) and Session 2 (MISS)
      // Projected: 19/22 = 86.36%
      const res = await request(app)
        .post("/api/planner/simulate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subSafeId,
          simulatedSessions: [
            { sessionId: futureSession1Id, action: "ATTEND" },
            { sessionId: futureSession2Id, action: "MISS" },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.subjectId).toBe(subSafeId);
      expect(res.body.currentMetrics.currentPercentage).toBe(90.0);
      expect(res.body.simulatedChanges.simulatedAttended).toBe(1);
      expect(res.body.simulatedChanges.simulatedMissed).toBe(1);

      // Projected checks
      expect(res.body.projectedMetrics.projectedAttended).toBe(19);
      expect(res.body.projectedMetrics.projectedConducted).toBe(22);
      expect(res.body.projectedMetrics.projectedPercentage).toBe(86.36);
      expect(res.body.projectedMetrics.willMeetTarget).toBe(true);
      // (1900 - 75 * 22) / 75 = (1900 - 1650) / 75 = 250 / 75 = 3
      expect(res.body.projectedMetrics.projectedSafeBunks).toBe(3);
      expect(res.body.explanation).toContain("MEETS your target of 75%");

      // CRITICAL CHECK: Verify that the database was NOT altered!
      const sess1 = await prisma.classSession.findUnique({
        where: { id: futureSession1Id },
        include: { attendanceRecord: true },
      });
      expect(sess1!.status).toBe("SCHEDULED");
      expect(sess1!.attendanceRecord).toBeNull();

      const sess2 = await prisma.classSession.findUnique({
        where: { id: futureSession2Id },
        include: { attendanceRecord: true },
      });
      expect(sess2!.status).toBe("SCHEDULED");
      expect(sess2!.attendanceRecord).toBeNull();
    });

    it("rejects simulation with duplicate session IDs in payload", async () => {
      const res = await request(app)
        .post("/api/planner/simulate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subSafeId,
          simulatedSessions: [
            { sessionId: futureSession1Id, action: "ATTEND" },
            { sessionId: futureSession1Id, action: "MISS" }, // Duplicate ID!
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Duplicate session IDs detected");
    });

    it("rejects simulation of an already conducted/evaluated session", async () => {
      const res = await request(app)
        .post("/api/planner/simulate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subSafeId,
          simulatedSessions: [
            { sessionId: evaluatedSessionId, action: "MISS" },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("has already been conducted/evaluated");
    });

    it("rejects simulation of a cancelled session", async () => {
      const res = await request(app)
        .post("/api/planner/simulate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subSafeId,
          simulatedSessions: [
            { sessionId: cancelledSessionId, action: "ATTEND" },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("is cancelled and cannot be simulated");
    });
  });

  describe("3. Semester-End Forecasts (GET /api/planner/forecast)", () => {
    it("generates forward-looking scenarios including custom trajectory", async () => {
      const res = await request(app)
        .get(`/api/planner/forecast?semesterId=${semesterAId}&customAttendanceRate=80`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.semesterId).toBe(semesterAId);
      expect(Array.isArray(res.body.subjects)).toBe(true);

      const cs101 = res.body.subjects.find((s: any) => s.subjectCode === "CS101");
      expect(cs101).toBeDefined();

      // CS101 baseline: 18/20, R=10
      // Scenario 1: Attend All Remaining -> 28/30 = 93.33%
      expect(cs101.scenarios.attendAllRemaining.projectedAttended).toBe(28);
      expect(cs101.scenarios.attendAllRemaining.projectedConducted).toBe(30);
      expect(cs101.scenarios.attendAllRemaining.projectedPercentage).toBe(93.33);
      expect(cs101.scenarios.attendAllRemaining.meetsTarget).toBe(true);

      // Scenario 2: Miss All Remaining -> 18/30 = 60.0%
      expect(cs101.scenarios.missAllRemaining.projectedAttended).toBe(18);
      expect(cs101.scenarios.missAllRemaining.projectedConducted).toBe(30);
      expect(cs101.scenarios.missAllRemaining.projectedPercentage).toBe(60.0);
      expect(cs101.scenarios.missAllRemaining.meetsTarget).toBe(false);

      // Scenario 3: Maintain Current Rate (90%) -> +9 attended -> 27/30 = 90.0%
      expect(cs101.scenarios.maintainCurrentRate.projectedAttended).toBe(27);
      expect(cs101.scenarios.maintainCurrentRate.projectedConducted).toBe(30);
      expect(cs101.scenarios.maintainCurrentRate.projectedPercentage).toBe(90.0);
      expect(cs101.scenarios.maintainCurrentRate.meetsTarget).toBe(true);

      // Scenario 4: Custom Rate (80%) -> +8 attended -> 26/30 = 86.67%
      expect(cs101.scenarios.customRateScenario.projectedAttended).toBe(26);
      expect(cs101.scenarios.customRateScenario.projectedConducted).toBe(30);
      expect(cs101.scenarios.customRateScenario.projectedPercentage).toBe(86.67);
      expect(cs101.scenarios.customRateScenario.meetsTarget).toBe(true);
    });
  });

  describe("4. Deficit Recovery Planner (GET /api/planner/recovery)", () => {
    it("returns only subjects in deficit and computes recovery feasibility and shortfall", async () => {
      const res = await request(app)
        .get(`/api/planner/recovery?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.totalDeficitSubjectsCount).toBe(2); // CS103 (feasible) and CS104 (impossible)

      // Feasible subject: CS103 (14/20, needs 4, 10 remaining)
      const feasibleSub = res.body.deficitSubjects.find((s: any) => s.subjectCode === "CS103");
      expect(feasibleSub).toBeDefined();
      expect(feasibleSub.recoveryClassesNeeded).toBe(4);
      expect(feasibleSub.remainingSessions).toBe(10);
      expect(feasibleSub.isAchievable).toBe(true);
      expect(feasibleSub.shortfall).toBe(0);
      expect(feasibleSub.recommendationCode).toBe("ATTEND");

      // Impossible subject: CS104 (6/10, needs 6, 2 remaining -> shortfall = 4)
      const impossibleSub = res.body.deficitSubjects.find((s: any) => s.subjectCode === "CS104");
      expect(impossibleSub).toBeDefined();
      expect(impossibleSub.recoveryClassesNeeded).toBe(6);
      expect(impossibleSub.remainingSessions).toBe(2);
      expect(impossibleSub.isAchievable).toBe(false);
      expect(impossibleSub.shortfall).toBe(4); // 6 needed - 2 remaining = 4 shortfall
      // Best achievable if 100% attended: (6 + 2) / (10 + 2) = 8 / 12 = 66.67%
      expect(impossibleSub.maxAchievablePercentage).toBe(66.67);
      expect(impossibleSub.recommendationCode).toBe("MATHEMATICALLY_IMPOSSIBLE");
      expect(impossibleSub.headline).toContain("Shortfall: 4 classes");
    });
  });

  describe("5. Multi-Tenant Authorization & IDOR Protection", () => {
    it("prevents User B from accessing User A's planner data", async () => {
      const res = await request(app)
        .get(`/api/planner/subjects?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      // User B has no subjects in semesterAId
      expect(res.status).toBe(200);
      expect(res.body.subjects.length).toBe(0);
    });

    it("prevents User B from simulating User A's sessions", async () => {
      const res = await request(app)
        .post("/api/planner/simulate")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          subjectId: subSafeId,
          simulatedSessions: [
            { sessionId: futureSession1Id, action: "ATTEND" },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Subject not found or access denied");
    });

    it("prevents User B from accessing User A's recovery plan", async () => {
      const res = await request(app)
        .get(`/api/planner/recovery?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.totalDeficitSubjectsCount).toBe(0);
      expect(res.body.deficitSubjects.length).toBe(0);
    });
  });
});
