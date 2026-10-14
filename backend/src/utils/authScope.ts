import { AppError } from "../middleware/error.middleware.js";
import { prisma } from "./db.js";

/**
 * Validates that a semester belongs to the authenticated user.
 * Throws 404 if not found or unauthorized to prevent ID enumeration.
 */
export async function getAuthorizedSemester(semesterId: string, userId: string) {
  const semester = await prisma.semester.findFirst({
    where: {
      id: semesterId,
      userId,
    },
  });

  if (!semester) {
    const error: AppError = new Error("Semester not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  return semester;
}

/**
 * Validates that a subject belongs to a semester owned by the authenticated user.
 */
export async function getAuthorizedSubject(subjectId: string, userId: string) {
  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      semester: {
        userId,
      },
    },
    include: {
      semester: true,
    },
  });

  if (!subject) {
    const error: AppError = new Error("Subject not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  return subject;
}

/**
 * Validates that a class session belongs to a semester owned by the authenticated user.
 */
export async function getAuthorizedSession(sessionId: string, userId: string) {
  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      semester: {
        userId,
      },
    },
    include: {
      subject: true,
      attendanceRecord: true,
    },
  });

  if (!session) {
    const error: AppError = new Error("Class session not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  return session;
}
