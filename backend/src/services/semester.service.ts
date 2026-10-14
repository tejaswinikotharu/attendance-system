import { CreateSemesterInput, UpdateSemesterInput } from "../schemas/semester.schema.js";
import { getAuthorizedSemester } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";

export const createSemester = async (
  userId: string,
  input: CreateSemesterInput
) => {
  return await prisma.$transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.semester.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const semester = await tx.semester.create({
      data: {
        userId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        targetPercent: input.targetPercent,
        isCurrent: input.isCurrent ?? true,
      },
    });

    return semester;
  });
};

export const getUserSemesters = async (userId: string) => {
  return await prisma.semester.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          subjects: true,
          sessions: true,
        },
      },
    },
  });
};

export const getCurrentSemester = async (userId: string) => {
  let semester = await prisma.semester.findFirst({
    where: { userId, isCurrent: true },
    include: {
      _count: {
        select: {
          subjects: true,
          sessions: true,
        },
      },
    },
  });

  if (!semester) {
    semester = await prisma.semester.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            subjects: true,
            sessions: true,
          },
        },
      },
    });
  }

  return semester;
};

export const getSemesterById = async (userId: string, semesterId: string) => {
  return await getAuthorizedSemester(semesterId, userId);
};

export const updateSemester = async (
  userId: string,
  semesterId: string,
  input: UpdateSemesterInput
) => {
  await getAuthorizedSemester(semesterId, userId);

  return await prisma.$transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.semester.updateMany({
        where: { userId, isCurrent: true, id: { not: semesterId } },
        data: { isCurrent: false },
      });
    }

    return await tx.semester.update({
      where: { id: semesterId },
      data: {
        name: input.name,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        targetPercent: input.targetPercent,
        isCurrent: input.isCurrent,
      },
    });
  });
};

export const deleteSemester = async (userId: string, semesterId: string) => {
  await getAuthorizedSemester(semesterId, userId);

  await prisma.semester.delete({
    where: { id: semesterId },
  });

  return { message: "Semester deleted successfully" };
};
