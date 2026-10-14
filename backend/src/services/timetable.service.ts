import { AppError } from "../middleware/error.middleware.js";
import {
  CreateTimetableSlotInput,
  UpdateTimetableSlotInput,
} from "../schemas/timetable.schema.js";
import { getAuthorizedSubject } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";

export const getAuthorizedSlot = async (slotId: string, userId: string) => {
  const slot = await prisma.timetableSlot.findFirst({
    where: {
      id: slotId,
      subject: {
        semester: {
          userId,
        },
      },
    },
    include: {
      subject: {
        include: {
          semester: true,
        },
      },
    },
  });

  if (!slot) {
    const error: AppError = new Error("Timetable slot not found or access denied.");
    error.statusCode = 404;
    throw error;
  }

  return slot;
};

export const createSlot = async (
  userId: string,
  input: CreateTimetableSlotInput
) => {
  // Validate subject ownership and get semester
  const subject = await getAuthorizedSubject(input.subjectId, userId);

  // Check for overlapping slots for the same subject on the same weekday
  const existingSlots = await prisma.timetableSlot.findMany({
    where: {
      subjectId: input.subjectId,
      dayOfWeek: input.dayOfWeek,
    },
  });

  for (const slot of existingSlots) {
    const isOverlapping =
      input.startTime < slot.endTime && input.endTime > slot.startTime;

    if (isOverlapping) {
      const error: AppError = new Error(
        `Slot (${input.startTime} - ${input.endTime}) overlaps with an existing slot (${slot.startTime} - ${slot.endTime}) for ${subject.code} on ${input.dayOfWeek}.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return await prisma.timetableSlot.create({
    data: {
      subjectId: input.subjectId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room ?? subject.room,
    },
    include: {
      subject: true,
    },
  });
};

export const getUserSlots = async (userId: string, semesterId?: string) => {
  return await prisma.timetableSlot.findMany({
    where: {
      subject: {
        semester: {
          userId,
          ...(semesterId ? { id: semesterId } : {}),
        },
      },
    },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          room: true,
          semesterId: true,
        },
      },
    },
  });
};

export const getSlotById = async (userId: string, slotId: string) => {
  return await getAuthorizedSlot(slotId, userId);
};

export const updateSlot = async (
  userId: string,
  slotId: string,
  input: UpdateTimetableSlotInput
) => {
  const currentSlot = await getAuthorizedSlot(slotId, userId);

  const targetDay = input.dayOfWeek ?? currentSlot.dayOfWeek;
  const targetStart = input.startTime ?? currentSlot.startTime;
  const targetEnd = input.endTime ?? currentSlot.endTime;

  if (targetStart >= targetEnd) {
    const error: AppError = new Error("Slot start time must be strictly before end time.");
    error.statusCode = 400;
    throw error;
  }

  // Check for overlap excluding current slot
  const otherSlots = await prisma.timetableSlot.findMany({
    where: {
      subjectId: currentSlot.subjectId,
      dayOfWeek: targetDay,
      id: { not: slotId },
    },
  });

  for (const slot of otherSlots) {
    const isOverlapping = targetStart < slot.endTime && targetEnd > slot.startTime;
    if (isOverlapping) {
      const error: AppError = new Error(
        `Updated slot (${targetStart} - ${targetEnd}) overlaps with an existing slot (${slot.startTime} - ${slot.endTime}) on ${targetDay}.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return await prisma.timetableSlot.update({
    where: { id: slotId },
    data: {
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room,
    },
    include: {
      subject: true,
    },
  });
};

export const deleteSlot = async (userId: string, slotId: string) => {
  await getAuthorizedSlot(slotId, userId);

  await prisma.timetableSlot.delete({
    where: { id: slotId },
  });

  return { message: "Timetable slot deleted successfully." };
};
