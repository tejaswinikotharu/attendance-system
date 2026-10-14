import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/utils/db.js";

describe("Phase 4: Daily Attendance Tracking & History Management", () => {
  const userA = {
    email: `att_user_a_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Attendance Student A",
  };

  const userB = {
    email: `att_user_b_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Attendance Student B",
  };

  let tokenA: string;
  let userAId: string;
  let tokenB: string;
  let userBId: string;

  let semesterAId: string;
  let subjectAId: string;
  let sessionPast1Id: string; // 2026-10-01 (Conducted)
  let sessionPast2Id: string; // 2026-10-02 (Conducted)
  let sessionCancelledId: string; // 2026-10-03 (Cancelled)
  let sessionFutureId: string; // 2026-12-01 (Future Scheduled)

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
        name: "Attendance Test Semester",
        startDate: "2026-09-01",
        endDate: "2026-12-31",
        targetPercent: 75,
        isCurrent: true,
      });
    expect(semRes.status).toBe(201);
    semesterAId = semRes.body.semester.id;

    // 4. Create Subject for User A
    const subRes = await request(app)
      .post("/api/subjects")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Software Architecture",
        code: "SE401",
        color: "#6366F1",
        targetPercent: 75,
        semesterId: semesterAId,
      });
    expect(subRes.status).toBe(201);
    subjectAId = subRes.body.subject.id;

    // 5. Seed concrete test sessions directly
    // Past Session 1
    const s1 = await prisma.classSession.create({
      data: {
        semesterId: semesterAId,
        subjectId: subjectAId,
        date: new Date("2026-10-01"),
        startTime: "09:00",
        endTime: "10:00",
        status: "CONDUCTED",
        room: "Room 101",
      },
    });
    sessionPast1Id = s1.id;

    // Past Session 2 (Currently SCHEDULED on past date, awaiting marking)
    const s2 = await prisma.classSession.create({
      data: {
        semesterId: semesterAId,
        subjectId: subjectAId,
        date: new Date("2026-10-02"),
        startTime: "10:00",
        endTime: "11:00",
        status: "SCHEDULED",
        room: "Room 101",
      },
    });
    sessionPast2Id = s2.id;

    // Cancelled Session
    const s3 = await prisma.classSession.create({
      data: {
        semesterId: semesterAId,
        subjectId: subjectAId,
        date: new Date("2026-10-03"),
        startTime: "09:00",
        endTime: "10:00",
        status: "CANCELLED",
        note: "Faculty leave",
      },
    });
    sessionCancelledId = s3.id;

    // Future Sessions (remaining in semester)
    const s4 = await prisma.classSession.create({
      data: {
        semesterId: semesterAId,
        subjectId: subjectAId,
        date: new Date("2026-12-01"),
        startTime: "09:00",
        endTime: "10:00",
        status: "SCHEDULED",
      },
    });
    sessionFutureId = s4.id;

    await prisma.classSession.createMany({
      data: [
        {
          semesterId: semesterAId,
          subjectId: subjectAId,
          date: new Date("2026-12-02"),
          startTime: "09:00",
          endTime: "10:00",
          status: "SCHEDULED",
        },
        {
          semesterId: semesterAId,
          subjectId: subjectAId,
          date: new Date("2026-12-03"),
          startTime: "09:00",
          endTime: "10:00",
          status: "SCHEDULED",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: { in: [userAId, userBId] },
      },
    });
    await prisma.$disconnect();
  });

  describe("1. Daily Attendance & Pending Response Strategy", () => {
    it("verifies no attendance_records rows exist initially for unconfirmed sessions", async () => {
      const recordsCount = await prisma.attendanceRecord.count({
        where: {
          session: { semesterId: semesterAId },
        },
      });
      // Crucial: Missing attendance records represent pending responses; no placeholder rows!
      expect(recordsCount).toBe(0);
    });

    it("fetches daily sessions for 2026-10-02 showing PENDING status without database rows", async () => {
      const res = await request(app)
        .get("/api/attendance/daily?date=2026-10-02")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.date).toBe("2026-10-02");
      expect(res.body.totalSessions).toBe(1);
      expect(res.body.pendingCount).toBe(1);
      expect(res.body.sessions[0].attendanceStatus).toBe("PENDING");
      expect(res.body.sessions[0].attendanceRecordId).toBeNull();
    });

    it("fetches daily sessions for 2026-10-03 showing CANCELLED status", async () => {
      const res = await request(app)
        .get("/api/attendance/daily?date=2026-10-03")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.cancelledCount).toBe(1);
      expect(res.body.sessions[0].attendanceStatus).toBe("CANCELLED");
      expect(res.body.sessions[0].sessionStatus).toBe("CANCELLED");
    });
  });

  describe("2. Marking Attendance & Real-Time Calculation Updates", () => {
    it("marks session 1 as ATTENDED and returns updated calculations", async () => {
      const res = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          sessionId: sessionPast1Id,
          status: "ATTENDED",
          note: "On-time arrival",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Attendance marked successfully");
      expect(res.body.record.status).toBe("ATTENDED");
      expect(res.body.record.note).toBe("On-time arrival");

      // Verify dynamic subject summary returned
      const summary = res.body.subjectSummary;
      expect(summary.attendedSessions).toBe(1);
      expect(summary.conductedSessions).toBe(1);
      expect(summary.currentPercentage).toBe(100.0);
      expect(summary.isMeetingTarget).toBe(true);
      expect(summary.statusBadge).toBe("SAFE");
    });

    it("marks past session 2 as ABSENT and transitions session status to CONDUCTED", async () => {
      const res = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          sessionId: sessionPast2Id,
          status: "ABSENT",
          note: "Doctor appointment",
        });

      expect(res.status).toBe(200);
      expect(res.body.record.status).toBe("ABSENT");

      // Verify session status transitioned in DB
      const updatedSession = await prisma.classSession.findUnique({
        where: { id: sessionPast2Id },
      });
      expect(updatedSession!.status).toBe("CONDUCTED");

      // Verify calculation: 1 attended, 1 absent = 2 conducted, 50.0%
      const summary = res.body.subjectSummary;
      expect(summary.attendedSessions).toBe(1);
      expect(summary.conductedSessions).toBe(2);
      expect(summary.currentPercentage).toBe(50.0);
      expect(summary.isMeetingTarget).toBe(false);
      expect(summary.requiredToRecover).toBe(2); // (75 * 2 - 100) / 25 = 50 / 25 = 2 classes
      expect(summary.recommendationCode).toBe("ATTEND");
    });

    it("corrects an attendance entry from ABSENT to ATTENDED without creating duplicate rows", async () => {
      const updateRes = await request(app)
        .put(`/api/attendance/${sessionPast2Id}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          status: "ATTENDED",
          note: "Correction: Attended late with permission",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.record.status).toBe("ATTENDED");

      // Verify strict 1:1 row guarantee in DB
      const records = await prisma.attendanceRecord.findMany({
        where: { sessionId: sessionPast2Id },
      });
      expect(records.length).toBe(1);

      // Verify calculation after correction: 2 attended, 0 absent = 100%
      const summary = updateRes.body.subjectSummary;
      expect(summary.attendedSessions).toBe(2);
      expect(summary.conductedSessions).toBe(2);
      expect(summary.currentPercentage).toBe(100.0);
      expect(summary.isMeetingTarget).toBe(true);
    });
  });

  describe("3. Business Rules: Rejection of Cancelled & Future Sessions", () => {
    it("rejects marking attendance for a CANCELLED class session", async () => {
      const res = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          sessionId: sessionCancelledId,
          status: "ATTENDED",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot mark attendance for a cancelled class session");
    });

    it("rejects marking attendance for a future SCHEDULED class session", async () => {
      const res = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          sessionId: sessionFutureId,
          status: "ATTENDED",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot mark attendance for a future scheduled session");
    });
  });

  describe("4. Multi-Tenant Authorization & IDOR Protection", () => {
    it("prevents User B from marking attendance on User A's session", async () => {
      const res = await request(app)
        .post("/api/attendance/mark")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          sessionId: sessionPast1Id,
          status: "ABSENT",
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Class session not found or access denied");
    });

    it("prevents User B from updating User A's attendance record", async () => {
      const res = await request(app)
        .put(`/api/attendance/${sessionPast1Id}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          status: "ABSENT",
        });

      expect(res.status).toBe(404);
    });

    it("prevents User B from reading User A's session attendance details", async () => {
      const res = await request(app)
        .get(`/api/attendance/sessions/${sessionPast1Id}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });

  describe("5. Attendance History Filtering & Pagination", () => {
    it("retrieves attendance history with pagination", async () => {
      const res = await request(app)
        .get("/api/attendance/history?page=1&limit=2")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(2);
      expect(res.body.pagination.currentPage).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalItems).toBe(6); // 6 total sessions
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it("filters history by status=ATTENDED", async () => {
      const res = await request(app)
        .get("/api/attendance/history?status=ATTENDED")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(2);
      expect(res.body.records.every((r: any) => r.attendanceStatus === "ATTENDED")).toBe(true);
    });

    it("filters history by status=CANCELLED", async () => {
      const res = await request(app)
        .get("/api/attendance/history?status=CANCELLED")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(1);
      expect(res.body.records[0].attendanceStatus).toBe("CANCELLED");
    });

    it("filters history by status=PENDING", async () => {
      const res = await request(app)
        .get("/api/attendance/history?status=PENDING")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(3);
      expect(res.body.records.every((r: any) => r.attendanceStatus === "PENDING")).toBe(true);
    });

    it("filters history by date range (October only)", async () => {
      const res = await request(app)
        .get("/api/attendance/history?startDate=2026-10-01&endDate=2026-10-31")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(3); // Oct 1, Oct 2, Oct 3
      expect(res.body.records.some((r: any) => r.date === "2026-12-01")).toBe(false);
    });
  });

  describe("6. Attendance CSV Export & Data Isolation", () => {
    it("exports attendance history as RFC-4180 compliant CSV", async () => {
      const res = await request(app)
        .get("/api/attendance/export-csv")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain(
        'filename="attendwise_attendance_history.csv"'
      );

      const lines = res.text.split("\n");
      expect(lines[0]).toBe(
        "Date,Subject Code,Subject Name,Start Time,End Time,Session Status,Attendance Status,Notes"
      );

      // Verify note escaping: "Correction: Attended late with permission"
      expect(res.text).toContain("Correction: Attended late with permission");
      expect(res.text).toContain("SE401");
      expect(res.text).toContain("Software Architecture");
    });

    it("enforces cross-user isolation in CSV export (User B cannot see User A's data)", async () => {
      const res = await request(app)
        .get("/api/attendance/export-csv")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      // User B has 0 sessions created in this test suite
      expect(res.text).not.toContain("SE401");
      expect(res.text).not.toContain("Software Architecture");
    });
  });
});
