import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api/client";

describe("API Client Error Handling & Payload Formatting", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extracts specific validation messages from AttendWise issues array instead of generic 'Validation Error'", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          error: "Validation Error",
          issues: [
            { field: "fullName", message: "Full name must be at least 2 characters" },
          ],
        }),
    } as any);

    await expect(
      api.register({ email: "test@college.edu", password: "Password123", fullName: "A" })
    ).rejects.toThrow("Full name must be at least 2 characters");
  });

  it("extracts specific error messages from errors array when backend returns generic 'Validation Error' message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          success: false,
          message: "Validation Error",
          errors: [{ field: "name", message: "Name is required" }],
        }),
    } as any);

    await expect(
      api.register({ email: "test@college.edu", password: "Password123", fullName: "A" })
    ).rejects.toThrow("Name is required");
  });

  it("sends both fullName and name in registration payload for compatibility", async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation((url, options) => {
      capturedBody = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        status: 201,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            message: "Registration successful",
            user: { id: "1", email: "alex@college.edu", fullName: "Alex Johnson" },
            token: "fake-jwt",
          }),
      });
    });

    await api.register({
      email: "alex@college.edu",
      password: "Password123",
      fullName: "Alex Johnson",
    });

    expect(capturedBody).toEqual({
      email: "alex@college.edu",
      password: "Password123",
      fullName: "Alex Johnson",
      name: "Alex Johnson",
    });
  });

  it("unwraps backend { semesters: [...] } object envelope into an array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          semesters: [
            { id: "s1", name: "Sem 1", startDate: "2026-01-01", endDate: "2026-05-01", targetPercent: 75, isCurrent: true },
          ],
        }),
    } as any);

    const semesters = await api.getSemesters();
    expect(Array.isArray(semesters)).toBe(true);
    expect(semesters).toHaveLength(1);
    expect(semesters[0].name).toBe("Sem 1");
  });

  it("unwraps backend { subjects: [...] } object envelope into an array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          subjects: [
            { id: "sub1", name: "Physics", code: "PHY101", color: "#ef4444" },
          ],
        }),
    } as any);

    const subjects = await api.getSubjects("s1");
    expect(Array.isArray(subjects)).toBe(true);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("Physics");
  });

  it("unwraps backend { slots: [...] } object envelope into an array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          slots: [
            { id: "slot1", subjectId: "sub1", dayOfWeek: "MONDAY", startTime: "09:00", endTime: "10:00" },
          ],
        }),
    } as any);

    const slots = await api.getSlots("s1");
    expect(Array.isArray(slots)).toBe(true);
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe("09:00");
  });
});
