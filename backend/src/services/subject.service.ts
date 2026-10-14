import { AppError } from "../middleware/error.middleware.js";
import { CreateSubjectInput, UpdateSubjectInput } from "../schemas/subject.schema.js";
import { getAuthorizedSemester, getAuthorizedSubject } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";
import { getCurrentSemester } from "./semester.service.js";

export const createSubject = async (
  userId: string,
  input: CreateSubjectInput
) => {
  let targetSemesterId = input.semesterId;

  if (!targetSemesterId) {
    const activeSemester = await getCurrentSemester(userId);
    if (!activeSemester) {
      const error: AppError = new Error(
        "No active semester found. Please create a semester first before adding subjects."
      );
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = activeSemester.id;
  }

  // Enforce multi-tenant authorization
  await getAuthorizedSemester(targetSemesterId, userId);

  // Check unique subject code in semester
  const existingSubject = await prisma.subject.findUnique({
    where: {
      semesterId_code: {
        semesterId: targetSemesterId,
        code: input.code,
      },
    },
  });

  if (existingSubject) {
    const error: AppError = new Error(
      `A subject with code "${input.code}" already exists in this semester.`
    );
    error.statusCode = 409;
    throw error;
  }

  return await prisma.subject.create({
    data: {
      semesterId: targetSemesterId,
      name: input.name,
      code: input.code,
      color: input.color,
      targetPercent: input.targetPercent,
      professor: input.professor,
      room: input.room,
    },
    include: {
      slots: true,
    },
  });
};

export const getUserSubjects = async (
  userId: string,
  semesterId?: string
) => {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const current = await getCurrentSemester(userId);
    if (current) {
      targetSemesterId = current.id;
    }
  }

  return await prisma.subject.findMany({
    where: {
      semester: {
        userId,
        ...(targetSemesterId ? { id: targetSemesterId } : {}),
      },
    },
    orderBy: { name: "asc" },
    include: {
      slots: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startTime: "asc" },
        ],
      },
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });
};

export const getSubjectById = async (userId: string, subjectId: string) => {
  const subject = await getAuthorizedSubject(subjectId, userId);

  return await prisma.subject.findUnique({
    where: { id: subject.id },
    include: {
      slots: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startTime: "asc" },
        ],
      },
      sessions: {
        orderBy: [
          { date: "asc" },
          { startTime: "asc" },
        ],
        include: {
          attendanceRecord: true,
        },
      },
    },
  });
};

export const updateSubject = async (
  userId: string,
  subjectId: string,
  input: UpdateSubjectInput
) => {
  const subject = await getAuthorizedSubject(subjectId, userId);

  if (input.code && input.code !== subject.code) {
    const existing = await prisma.subject.findUnique({
      where: {
        semesterId_code: {
          semesterId: subject.semesterId,
          code: input.code,
        },
      },
    });

    if (existing) {
      const error: AppError = new Error(
        `A subject with code "${input.code}" already exists in this semester.`
      );
      error.statusCode = 409;
      throw error;
    }
  }

  return await prisma.subject.update({
    where: { id: subjectId },
    data: {
      name: input.name,
      code: input.code,
      color: input.color,
      targetPercent: input.targetPercent,
      professor: input.professor,
      room: input.room,
    },
    include: {
      slots: true,
    },
  });
};

export const deleteSubject = async (userId: string, subjectId: string) => {
  await getAuthorizedSubject(subjectId, userId);

  await prisma.subject.delete({
    where: { id: subjectId },
  });

  return { message: "Subject and related timetable data deleted successfully." };
};
