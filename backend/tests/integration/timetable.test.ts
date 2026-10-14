import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/utils/db.js";

describe("Phase 3: Timetable Engine, Deduplication, Session Generation & CSV Import", () => {
  const userA = {
    email: `tt_user_a_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Timetable Student A",
  };

  const userB = {
    email: `tt_user_b_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Timetable Student B",
  };

  let tokenA: string;
  let userAId: string;
  let tokenB: string;
  let userBId: string;

  let semesterAId: string;
  let subjectAId: string;
  let slotAId: string;

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

    // 3. Create active Semester for User A: Nov 2 to Nov 15, 2026 (2 weeks)
    const semRes = await request(app)
      .post("/api/semesters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Autumn 2026",
        startDate: "2026-11-02", // Monday
        endDate: "2026-11-15",   // Sunday
        targetPercent: 75,
        isCurrent: true,
      });
    expect(semRes.status).toBe(201);
    semesterAId = semRes.body.semester.id;
  });

  afterAll(async () => {
    // Clean up created test data
    await prisma.user.deleteMany({
      where: {
        id: { in: [userAId, userBId] },
      },
    });
    await prisma.$disconnect();
  });

  describe("1. Subject Management & Validation", () => {
    it("creates a subject with valid fields", async () => {
      const res = await request(app)
        .post("/api/subjects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Computer Networks",
          code: "CS501",
          color: "#2563EB",
          targetPercent: 75,
          professor: "Dr. Miller",
          room: "Lab 3",
          semesterId: semesterAId,
        });

      expect(res.status).toBe(201);
      expect(res.body.subject.code).toBe("CS501");
      expect(res.body.subject.name).toBe("Computer Networks");
      expect(res.body.subject.targetPercent).toBe(75);
      subjectAId = res.body.subject.id;
    });

    it("rejects duplicate subject code in the same semester", async () => {
      const res = await request(app)
        .post("/api/subjects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Another Networks Class",
          code: "CS501", // duplicate
          semesterId: semesterAId,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already exists in this semester");
    });

    it("rejects subject with invalid target percentage (e.g. 0% or 100%)", async () => {
      const resZero = await request(app)
        .post("/api/subjects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Invalid Target Subject",
          code: "CS999",
          targetPercent: 0,
          semesterId: semesterAId,
        });
      expect(resZero.status).toBe(400);

      const resHundred = await request(app)
        .post("/api/subjects")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Invalid Target Subject",
          code: "CS999",
          targetPercent: 100,
          semesterId: semesterAId,
        });
      expect(resHundred.status).toBe(400);
    });

    it("lists all subjects for the authenticated user", async () => {
      const res = await request(app)
        .get("/api/subjects")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.subjects)).toBe(true);
      expect(res.body.subjects.some((s: any) => s.id === subjectAId)).toBe(true);
    });

    it("updates subject name and color", async () => {
      const res = await request(app)
        .put(`/api/subjects/${subjectAId}`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          name: "Advanced Computer Networks",
          color: "#3B82F6",
        });

      expect(res.status).toBe(200);
      expect(res.body.subject.name).toBe("Advanced Computer Networks");
      expect(res.body.subject.color).toBe("#3B82F6");
    });
  });

  describe("2. Timetable Slot Management & Validation", () => {
    it("creates a valid timetable slot", async () => {
      const res = await request(app)
        .post("/api/timetable/slots")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subjectAId,
          dayOfWeek: "MONDAY",
          startTime: "09:00",
          endTime: "10:00",
          room: "Lab 3",
        });

      expect(res.status).toBe(201);
      expect(res.body.slot.dayOfWeek).toBe("MONDAY");
      expect(res.body.slot.startTime).toBe("09:00");
      expect(res.body.slot.endTime).toBe("10:00");
      slotAId = res.body.slot.id;
    });

    it("adds a second slot on WEDNESDAY for the same subject", async () => {
      const res = await request(app)
        .post("/api/timetable/slots")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subjectAId,
          dayOfWeek: "WEDNESDAY",
          startTime: "10:00",
          endTime: "11:00",
          room: "Lab 3",
        });

      expect(res.status).toBe(201);
    });

    it("rejects invalid time range where startTime >= endTime", async () => {
      const res = await request(app)
        .post("/api/timetable/slots")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subjectAId,
          dayOfWeek: "FRIDAY",
          startTime: "11:00",
          endTime: "10:00", // Inverted!
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
    });

    it("rejects overlapping slot for same subject on same day", async () => {
      // Existing MONDAY slot is 09:00 to 10:00
      const res = await request(app)
        .post("/api/timetable/slots")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subjectId: subjectAId,
          dayOfWeek: "MONDAY",
          startTime: "09:30", // overlaps!
          endTime: "10:30",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("overlaps with an existing slot");
    });
  });

  describe("3. Multi-Tenant Authorization & IDOR Protection", () => {
    it("prevents User B from accessing User A's subject", async () => {
      const res = await request(app)
        .get(`/api/subjects/${subjectAId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("prevents User B from modifying User A's subject", async () => {
      const res = await request(app)
        .put(`/api/subjects/${subjectAId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ name: "Hacked Subject Name" });

      expect(res.status).toBe(404);
    });

    it("prevents User B from deleting User A's subject", async () => {
      const res = await request(app)
        .delete(`/api/subjects/${subjectAId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("prevents User B from viewing or deleting User A's timetable slot", async () => {
      const getRes = await request(app)
        .get(`/api/timetable/slots/${slotAId}`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(getRes.status).toBe(404);

      const delRes = await request(app)
        .delete(`/api/timetable/slots/${slotAId}`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(delRes.status).toBe(404);
    });
  });

  describe("4. Class Session Generation & Holiday Exclusion", () => {
    it("records a holiday on Wednesday 2026-11-04", async () => {
      await prisma.holiday.create({
        data: {
          semesterId: semesterAId,
          date: new Date("2026-11-04"),
          title: "Mid-Term Holiday",
        },
      });
    });

    it("generates sessions across semester timeline, skipping holiday", async () => {
      // Semester timeline: Nov 2 to Nov 15, 2026 (2 weeks)
      // Slots: Monday 09:00 (Nov 2, Nov 9 = 2 sessions)
      // Wednesday 10:00 (Nov 4 is holiday -> skipped! Nov 11 = 1 session)
      // Total expected generated: 2 + 1 = 3 sessions
      const res = await request(app)
        .post("/api/timetable/generate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ semesterId: semesterAId });

      expect(res.status).toBe(200);
      expect(res.body.summary.generatedSessionsCount).toBe(3);
      expect(res.body.summary.holidaysSkippedCount).toBeGreaterThanOrEqual(1);

      // Verify sessions in database
      const sessions = await prisma.classSession.findMany({
        where: { semesterId: semesterAId },
        orderBy: { date: "asc" },
      });

      expect(sessions.length).toBe(3);
      const sessionDates = sessions.map((s) => s.date.toISOString().slice(0, 10));
      expect(sessionDates).toContain("2026-11-02"); // Monday 1
      expect(sessionDates).not.toContain("2026-11-04"); // Wednesday 1 (Holiday!)
      expect(sessionDates).toContain("2026-11-09"); // Monday 2
      expect(sessionDates).toContain("2026-11-11"); // Wednesday 2
    });

    it("enforces idempotency: running generation again creates 0 duplicates", async () => {
      const res = await request(app)
        .post("/api/timetable/generate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ semesterId: semesterAId });

      expect(res.status).toBe(200);
      expect(res.body.summary.generatedSessionsCount).toBe(0);
      expect(res.body.summary.preservedSessionsCount).toBe(3);

      const count = await prisma.classSession.count({
        where: { semesterId: semesterAId },
      });
      expect(count).toBe(3);
    });

    it("preserves historical attendance records during timetable regeneration", async () => {
      // Mark attendance on Monday 2026-11-02
      const firstSession = await prisma.classSession.findFirst({
        where: {
          semesterId: semesterAId,
          date: new Date("2026-11-02"),
        },
      });
      expect(firstSession).toBeDefined();

      await prisma.attendanceRecord.create({
        data: {
          sessionId: firstSession!.id,
          status: "ATTENDED",
          note: "Attended lecture on routing algorithms",
        },
      });

      // Regenerate sessions
      const regenRes = await request(app)
        .post("/api/timetable/generate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ semesterId: semesterAId });

      expect(regenRes.status).toBe(200);

      // Verify attendance record is intact
      const preservedRecord = await prisma.attendanceRecord.findUnique({
        where: { sessionId: firstSession!.id },
      });
      expect(preservedRecord).toBeDefined();
      expect(preservedRecord!.status).toBe("ATTENDED");
      expect(preservedRecord!.note).toBe("Attended lecture on routing algorithms");
    });
  });

  describe("5. CSV Timetable Import & Transactional Rollback", () => {
    it("provides a downloadable CSV template with correct headers", async () => {
      const res = await request(app).get("/api/timetable/template-csv");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain(
        "subjectCode,subjectName,dayOfWeek,startTime,endTime,room,targetPercent,professor,color"
      );
    });

    it("rejects invalid CSV and performs complete transactional rollback", async () => {
      const invalidCsv = [
        "subjectCode,subjectName,dayOfWeek,startTime,endTime,room,targetPercent,professor,color",
        "CS801,Valid Subject,MONDAY,08:00,09:00,Room 1,75,Prof A,#2563EB",
        "CS802,Invalid Day Subject,FUNDAY,09:00,10:00,Room 2,75,Prof B,#2563EB", // Invalid day!
        "CS803,Inverted Time Subject,TUESDAY,11:00,10:00,Room 3,75,Prof C,#2563EB", // Inverted time!
      ].join("\n");

      const res = await request(app)
        .post("/api/timetable/import-csv")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          csvContent: invalidCsv,
          semesterId: semesterAId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
      expect(res.body.errors.some((e: any) => e.column === "dayOfWeek")).toBe(true);
      expect(res.body.errors.some((e: any) => e.column === "endTime")).toBe(true);

      // Transactional check: CS801 on row 2 MUST NOT have been created in the database!
      const rolledBackSubject = await prisma.subject.findFirst({
        where: {
          semesterId: semesterAId,
          code: "CS801",
        },
      });
      expect(rolledBackSubject).toBeNull();
    });

    it("successfully imports a valid CSV and generates sessions atomically", async () => {
      const validCsv = [
        "subjectCode,subjectName,dayOfWeek,startTime,endTime,room,targetPercent,professor,color",
        "CS701,Database Systems,TUESDAY,14:00,15:00,Hall 1,80,Dr. Stone,#10B981",
        "CS701,Database Systems,THURSDAY,14:00,15:00,Hall 1,80,Dr. Stone,#10B981",
      ].join("\n");

      const res = await request(app)
        .post("/api/timetable/import-csv")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          csvContent: validCsv,
          semesterId: semesterAId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.importedSubjectsCount).toBe(1);
      expect(res.body.importedSlotsCount).toBe(2);

      // Verify subject exists
      const dbSubject = await prisma.subject.findFirst({
        where: {
          semesterId: semesterAId,
          code: "CS701",
        },
        include: { slots: true },
      });
      expect(dbSubject).toBeDefined();
      expect(dbSubject!.name).toBe("Database Systems");
      expect(dbSubject!.targetPercent).toBe(80);
      expect(dbSubject!.slots.length).toBe(2);

      // Verify sessions generated for CS701 across Nov 2 to Nov 15
      // Tuesdays: Nov 3, Nov 10 (2 sessions)
      // Thursdays: Nov 5, Nov 12 (2 sessions)
      const cs701Sessions = await prisma.classSession.findMany({
        where: {
          semesterId: semesterAId,
          subjectId: dbSubject!.id,
        },
      });
      expect(cs701Sessions.length).toBe(4);
    });
  });
});
