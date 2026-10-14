import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getAuthorizedSubject } from "../../src/utils/authScope.js";
import { prisma } from "../../src/utils/db.js";

describe("Authentication & Multi-Tenant Authorization Integration Tests", () => {
  const testUserA = {
    email: `student_a_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Student Alpha",
  };

  const testUserB = {
    email: `student_b_${Date.now()}@university.edu`,
    password: "Password123!",
    fullName: "Student Beta",
  };

  let tokenA: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    // Ensure clean state for test run
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUserA.email, testUserB.email],
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testUserA.email, testUserB.email],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("POST /api/auth/register", () => {
    it("successfully registers a new student with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUserA);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Registration successful");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUserA.email);
      expect(res.body.user.fullName).toBe(testUserA.fullName);
      expect(res.body.user.passwordHash).toBeUndefined(); // Never expose password hash!
      expect(res.body.token).toBeDefined();

      tokenA = res.body.token;
      userAId = res.body.user.id;
    });

    it("rejects duplicate registration with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUserA);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already exists");
    });

    it("rejects registration with invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "not-an-email",
          password: "Password123!",
          fullName: "Invalid Student",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "email" }),
        ])
      );
    });

    it("rejects registration with weak password (< 8 chars)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "weakpass@university.edu",
          password: "pass",
          fullName: "Weak Student",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
    });
  });

  describe("POST /api/auth/login", () => {
    it("successfully logs in with correct credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUserA.email,
          password: testUserA.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testUserA.email);
    });

    it("rejects login with incorrect password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUserA.email,
          password: "WrongPassword999!",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password.");
    });

    it("rejects login with non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "does_not_exist@university.edu",
          password: "Password123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password.");
    });
  });

  describe("GET /api/auth/me (Protected Route)", () => {
    it("returns 401 Unauthorized when no Authorization header is provided", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("returns 401 Unauthorized when malformed token is provided", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-junk-token");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("returns user profile when valid Bearer token is provided", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(userAId);
      expect(res.body.user.email).toBe(testUserA.email);
      expect(res.body.user.fullName).toBe(testUserA.fullName);
    });
  });

  describe("Cross-User Data Isolation (Multi-Tenant Authorization)", () => {
    it("prevents User B from accessing User A's private subject records", async () => {
      // 1. Register User B
      const regB = await request(app)
        .post("/api/auth/register")
        .send(testUserB);
      expect(regB.status).toBe(201);
      expect(regB.body.token).toBeDefined();
      userBId = regB.body.user.id;

      // 2. Create Semester and Subject owned by User A
      const semesterA = await prisma.semester.create({
        data: {
          userId: userAId,
          name: "Semester A",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-12-15"),
          targetPercent: 75,
        },
      });

      const subjectA = await prisma.subject.create({
        data: {
          semesterId: semesterA.id,
          name: "Advanced Distributed Systems",
          code: "CS601",
          color: "#10B981",
        },
      });

      // 3. User A can access their own subject
      const subjectFoundA = await getAuthorizedSubject(subjectA.id, userAId);
      expect(subjectFoundA.id).toBe(subjectA.id);
      expect(subjectFoundA.code).toBe("CS601");

      // 4. User B MUST be denied access to User A's subject (throwing 404)
      await expect(getAuthorizedSubject(subjectA.id, userBId)).rejects.toThrow(
        /Subject not found or access denied/
      );
    });
  });
});
