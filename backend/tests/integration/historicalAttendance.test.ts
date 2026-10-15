import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/utils/db.js";

describe("Historical Attendance Import & Baseline Integration Tests", () => {
  const userA = {
    email: `hist_user_a_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Historical Student A",
  };

  const userB = {
    email: `hist_user_b_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Historical Student B",
  };

  let tokenA: string;
  let userAId: string;
  let tokenB: string;
  let userBId: string;
  let semesterAId: string;
  let semesterBId: string;

  const sampleCsv = [
    "subjectCode,subjectName,present,total",
    "CSEN3121,Adhoc and Sensor Networks,34,39",
    "VIVA3555,Comprehensive Examination,12,13",
    "CIVL2281,Disaster Management,35,39",
    "SOCY3071,Gender and Sexuality,29,38",
    "CSEN3051,Wireless Sensor Networks,36,39",
  ].join("\n");

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
    const semARes = await request(app)
      .post("/api/semesters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "User A Historical Semester",
        startDate: "2026-08-01",
        endDate: "2026-12-31",
        targetPercent: 75,
        isCurrent: true,
      });
    expect(semARes.status).toBe(201);
    semesterAId = semARes.body.semester.id;

    // 4. Create active Semester for User B
    const semBRes = await request(app)
      .post("/api/semesters")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        name: "User B Historical Semester",
        startDate: "2026-08-01",
        endDate: "2026-12-31",
        targetPercent: 75,
        isCurrent: true,
      });
    expect(semBRes.status).toBe(201);
    semesterBId = semBRes.body.semester.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
  });

  describe("CSV Template Download", () => {
    it("returns the standard CSV template with required columns", async () => {
      const res = await request(app)
        .get("/api/attendance/historical-template-csv")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("subjectCode,subjectName,present,total");
      expect(res.text).toContain("CSEN3121,Adhoc and Sensor Networks,34,39");
    });

    it("requires authentication to download the template", async () => {
      const res = await request(app).get("/api/attendance/historical-template-csv");
      expect(res.status).toBe(401);
    });
  });

  describe("Import Preview & Validation", () => {
    it("successfully previews the sample dataset and calculates 146/168 (86.90%)", async () => {
      const res = await request(app)
        .post("/api/attendance/historical/preview")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          rawCsv: sampleCsv,
        });

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.summary.totalSubjects).toBe(5);
      expect(res.body.summary.totalPresent).toBe(146);
      expect(res.body.summary.totalConducted).toBe(168);
      expect(res.body.summary.totalAbsent).toBe(22);
      expect(res.body.summary.overallPercentage).toBe(86.9);
      expect(res.body.rows).toHaveLength(5);

      // Verify each row's calculated absent and percentage
      const csen3121 = res.body.rows.find((r: any) => r.subjectCode === "CSEN3121");
      expect(csen3121).toBeDefined();
      expect(csen3121.present).toBe(34);
      expect(csen3121.total).toBe(39);
      expect(csen3121.absent).toBe(5);
      expect(csen3121.percentage).toBe(87.18);
      expect(csen3121.errors).toHaveLength(0);
      expect(csen3121.willCreateSubject).toBe(true);
    });

    it("detects and rejects duplicate subject codes within the same import", async () => {
      const duplicateCsv = [
        "subjectCode,subjectName,present,total",
        "CSEN3121,Subject One,10,12",
        "CSEN3121,Subject One Duplicate,15,20",
      ].join("\n");

      const res = await request(app)
        .post("/api/attendance/historical/preview")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          rawCsv: duplicateCsv,
        });

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
      expect(res.body.rows[0].errors.some((e: string) => e.includes("Duplicate"))).toBe(true);
      expect(res.body.rows[1].errors.some((e: string) => e.includes("Duplicate"))).toBe(true);
    });

    it("validates invalid counts: negative present, zero total, and present > total", async () => {
      const invalidRows = [
        { subjectCode: "SUB1", subjectName: "Negative Present", present: -5, total: 10 },
        { subjectCode: "SUB2", subjectName: "Zero Total", present: 0, total: 0 },
        { subjectCode: "SUB3", subjectName: "Present Exceeds Total", present: 15, total: 10 },
      ];

      const res = await request(app)
        .post("/api/attendance/historical/preview")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          items: invalidRows,
        });

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
      expect(res.body.rows[0].errors).toContain("Present count must be a non-negative integer");
      expect(res.body.rows[1].errors).toContain("Total conducted classes must be greater than zero");
      expect(res.body.rows[2].errors.some((e: string) => e.includes("cannot exceed total"))).toBe(true);
    });
  });

  describe("Transactional Import Execution", () => {
    it("successfully imports the sample dataset and establishes historical baselines", async () => {
      const items = [
        { subjectCode: "CSEN3121", subjectName: "Adhoc and Sensor Networks", present: 34, total: 39 },
        { subjectCode: "VIVA3555", subjectName: "Comprehensive Examination", present: 12, total: 13 },
        { subjectCode: "CIVL2281", subjectName: "Disaster Management", present: 35, total: 39 },
        { subjectCode: "SOCY3071", subjectName: "Gender and Sexuality", present: 29, total: 38 },
        { subjectCode: "CSEN3051", subjectName: "Wireless Sensor Networks", present: 36, total: 39 },
      ];

      const res = await request(app)
        .post("/api/attendance/historical/import")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          items,
        });

      expect(res.status).toBe(200);
      expect(res.body.importedCount).toBe(5);
      expect(res.body.summary.totalPresent).toBe(146);
      expect(res.body.summary.totalConducted).toBe(168);
      expect(res.body.summary.overallPercentage).toBe(86.9);
      expect(res.body.batchId).toBeDefined();

      // Verify that database has exact HistoricalAttendance records
      const baselines = await prisma.historicalAttendance.findMany({
        where: { semesterId: semesterAId },
        include: { subject: true },
      });
      expect(baselines).toHaveLength(5);
      const totalAttendedDb = baselines.reduce((acc, b) => acc + b.present, 0);
      const totalConductedDb = baselines.reduce((acc, b) => acc + b.total, 0);
      expect(totalAttendedDb).toBe(146);
      expect(totalConductedDb).toBe(168);
    });

    it("prevents accidental duplicate imports by rejecting without overwrite flag (409 Conflict)", async () => {
      const duplicateAttempt = [
        { subjectCode: "CSEN3121", subjectName: "Adhoc and Sensor Networks", present: 34, total: 39 },
      ];

      const res = await request(app)
        .post("/api/attendance/historical/import")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          items: duplicateAttempt,
          overwriteExisting: false,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Historical attendance baseline already exists");
    });

    it("safely updates baseline when overwriteExisting is explicitly set to true", async () => {
      const updateAttempt = [
        { subjectCode: "CSEN3121", subjectName: "Adhoc and Sensor Networks", present: 35, total: 40 },
      ];

      const res = await request(app)
        .post("/api/attendance/historical/import")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          items: updateAttempt,
          overwriteExisting: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.importedCount).toBe(1);

      // Verify DB was updated
      const updated = await prisma.historicalAttendance.findFirst({
        where: {
          semesterId: semesterAId,
          subject: { code: "CSEN3121" },
        },
      });
      expect(updated?.present).toBe(35);
      expect(updated?.total).toBe(40);

      // Restore to 34/39 for subsequent test consistency
      await prisma.historicalAttendance.update({
        where: { id: updated!.id },
        data: { present: 34, total: 39 },
      });
    });

    it("enforces multi-tenant isolation: User B cannot import attendance into User A's semester", async () => {
      const res = await request(app)
        .post("/api/attendance/historical/import")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          semesterId: semesterAId,
          items: [
            { subjectCode: "HACK101", subjectName: "Unauthorized Subject", present: 10, total: 10 },
          ],
        });

      expect(res.status).toBe(404);
    });
    it("enforces multi-tenant isolation: User B cannot view User A's historical baselines", async () => {
      const res = await request(app)
        .get(`/api/attendance/historical?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("enforces multi-tenant isolation: User B cannot delete User A's historical baseline", async () => {
      const subjectA = await prisma.subject.findFirst({
        where: { semesterId: semesterAId, code: "CSEN3121" },
      });
      expect(subjectA).toBeDefined();

      const res = await request(app)
        .delete(`/api/attendance/historical/${subjectA!.id}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("guarantees transactional rollback: rejects invalid rows without partial database commits", async () => {
      // Unique subject codes for this test
      const validCode = "ROLLBACK_OK";
      const invalidCode = "ROLLBACK_FAIL";

      const badBatch = [
        { subjectCode: validCode, subjectName: "Valid Subject Before Fail", present: 10, total: 10 },
        { subjectCode: invalidCode, subjectName: "Invalid Subject Exceeds", present: 25, total: 10 }, // present > total
      ];

      const res = await request(app)
        .post("/api/attendance/historical/import")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          semesterId: semesterAId,
          items: badBatch,
        });

      expect(res.status).toBe(400);

      // Verify rollback: validCode must NOT exist in the database!
      const subjectInDb = await prisma.subject.findFirst({
        where: { semesterId: semesterAId, code: validCode },
      });
      expect(subjectInDb).toBeNull();

      const baselineInDb = await prisma.historicalAttendance.findFirst({
        where: { semesterId: semesterAId, subject: { code: validCode } },
      });
      expect(baselineInDb).toBeNull();
    });
  });

  describe("Integration with Bunk Planner, What-If & Recovery", () => {
    it("integrates historical baseline into getSemesterPlannerSubjects metrics", async () => {
      const res = await request(app)
        .get(`/api/planner/subjects?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.subjects).toHaveLength(5);

      // CSEN3121: 34 attended / 39 conducted = 87.18%, Target = 75%
      // Safe bunks: floor((100 * 34 - 75 * 39) / 75) = floor((3400 - 2925) / 75) = floor(475 / 75) = 6
      const csen = res.body.subjects.find((s: any) => s.subjectCode === "CSEN3121");
      expect(csen).toBeDefined();
      expect(csen.conductedSessions).toBe(39);
      expect(csen.attendedSessions).toBe(34);
      expect(csen.currentPercentage).toBe(87.18);
      expect(csen.isMeetingTarget).toBe(true);
      expect(csen.safeBunks).toBe(6);
      expect(csen.historicalBaseline).toBeDefined();
      expect(csen.historicalBaseline.present).toBe(34);
      expect(csen.historicalBaseline.total).toBe(39);
    });

    it("prevents double-counting in What-If attendance simulation", async () => {
      const subject = await prisma.subject.findFirst({
        where: { semesterId: semesterAId, code: "CSEN3121" },
      });
      expect(subject).toBeDefined();

      // Create two future scheduled sessions
      const futureDate1 = new Date();
      futureDate1.setUTCDate(futureDate1.getUTCDate() + 10);
      futureDate1.setUTCHours(0, 0, 0, 0);

      const futureDate2 = new Date();
      futureDate2.setUTCDate(futureDate2.getUTCDate() + 11);
      futureDate2.setUTCHours(0, 0, 0, 0);

      const session1 = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subject!.id,
          date: futureDate1,
          startTime: "10:00",
          endTime: "11:00",
          status: "SCHEDULED",
        },
      });

      const session2 = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subject!.id,
          date: futureDate2,
          startTime: "10:00",
          endTime: "11:00",
          status: "SCHEDULED",
        },
      });

      // Simulate: Attend session 1, Miss session 2
      const simRes = await request(app)
        .post("/api/planner/simulate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subject!.id,
          simulatedSessions: [
            { sessionId: session1.id, action: "ATTEND" },
            { sessionId: session2.id, action: "MISS" },
          ],
        });

      expect(simRes.status).toBe(200);
      // Current metrics must reflect baseline (34 attended / 39 conducted)
      expect(simRes.body.currentMetrics.attendedSessions).toBe(34);
      expect(simRes.body.currentMetrics.conductedSessions).toBe(39);
      expect(simRes.body.currentMetrics.currentPercentage).toBe(87.18);

      // Projected metrics: (34 + 1) / (39 + 2) = 35 / 41 = 85.37%
      // NOT double counting baseline!
      expect(simRes.body.projectedMetrics.projectedAttended).toBe(35);
      expect(simRes.body.projectedMetrics.projectedConducted).toBe(41);
      expect(simRes.body.projectedMetrics.projectedPercentage).toBe(85.37);

      // Clean up simulated sessions
      await prisma.classSession.deleteMany({
        where: { id: { in: [session1.id, session2.id] } },
      });
    });

    it("prevents double-counting in semester forecasts", async () => {
      const forecastRes = await request(app)
        .get(`/api/planner/forecast?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(forecastRes.status).toBe(200);
      const csenForecast = forecastRes.body.subjects.find(
        (f: any) => f.subjectCode === "CSEN3121"
      );
      expect(csenForecast).toBeDefined();
      expect(csenForecast.currentMetrics.conductedSessions).toBe(39);
      expect(csenForecast.currentMetrics.attendedSessions).toBe(34);
      expect(csenForecast.currentMetrics.currentPercentage).toBe(87.18);
    });

    it("combines historical baseline with newly marked future class sessions exactly once", async () => {
      // 1. Find subject CSEN3121
      const subject = await prisma.subject.findFirst({
        where: { semesterId: semesterAId, code: "CSEN3121" },
      });
      expect(subject).toBeDefined();

      // 2. Create a conducted session for today
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const session = await prisma.classSession.create({
        data: {
          semesterId: semesterAId,
          subjectId: subject!.id,
          date: today,
          startTime: "09:00",
          endTime: "10:00",
          status: "CONDUCTED",
        },
      });

      // 3. Mark attendance as ATTENDED
      const markRes = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          sessionId: session.id,
          status: "ATTENDED",
        });

      expect(markRes.status).toBe(200);
      // Combined: 34 + 1 = 35 attended; 39 + 1 = 40 conducted. 35/40 = 87.50%
      expect(markRes.body.subjectSummary.attendedSessions).toBe(35);
      expect(markRes.body.subjectSummary.conductedSessions).toBe(40);
      expect(markRes.body.subjectSummary.currentPercentage).toBe(87.5);

      // Clean up the created test session
      await prisma.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
      await prisma.classSession.delete({ where: { id: session.id } });
    });

    it("accurately reports deficit recovery when a subject baseline is below target", async () => {
      // Create a deficit subject for User B: 20 attended out of 30 conducted (66.67%, target 75%)
      const items = [
        { subjectCode: "DEF101", subjectName: "Deficit Physics", present: 20, total: 30 },
      ];

      await request(app)
        .post("/api/attendance/historical/import")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          semesterId: semesterBId,
          items,
        });

      const recoveryRes = await request(app)
        .get(`/api/planner/recovery?semesterId=${semesterBId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(recoveryRes.status).toBe(200);
      expect(recoveryRes.body.totalDeficitSubjectsCount).toBe(1);
      const def = recoveryRes.body.deficitSubjects[0];
      expect(def.subjectCode).toBe("DEF101");
      // Recovery calculation: ceil((75 * 30 - 100 * 20) / (100 - 75)) = ceil((2250 - 2000) / 25) = 10 classes
      expect(def.recoveryClassesNeeded).toBe(10);
    });
  });

  describe("Attendance History & CSV Export Identification", () => {
    it("distinguishes historical aggregate baselines in attendance history", async () => {
      const res = await request(app)
        .get(`/api/attendance/history?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.historicalBaselines).toHaveLength(5);
      const base = res.body.historicalBaselines[0];
      expect(base.isAggregateBaseline).toBe(true);
      expect(base.present).toBeDefined();
      expect(base.total).toBeDefined();
      expect(base.percentage).toBeDefined();
      expect(base.note).toContain("Aggregate historical baseline");
    });

    it("identifies aggregate baseline rows in CSV export", async () => {
      const res = await request(app)
        .get(`/api/attendance/export-csv?semesterId=${semesterAId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("[AGGREGATE BASELINE]");
      expect(res.text).toContain("CSEN3121");
      expect(res.text).toContain("34/39 ATTENDED (87.18%)");
    });
  });
});
