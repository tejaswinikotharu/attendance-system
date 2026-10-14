import { NextFunction, Request, Response } from "express";
import {
  getTimetableCsvTemplate,
  importTimetableCsv,
} from "../services/csvTimetable.service.js";
import {
  createSlot,
  deleteSlot,
  getSlotById,
  getUserSlots,
  updateSlot,
} from "../services/timetable.service.js";
import { generateSemesterSessions } from "../services/timetableGenerator.service.js";

export const handleCreateSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slot = await createSlot(req.user!.id, req.body);
    res.status(201).json({
      message: "Timetable slot created successfully",
      slot,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesterId = req.query.semesterId as string | undefined;
    const slots = await getUserSlots(req.user!.id, semesterId);
    res.status(200).json({ slots });
  } catch (error) {
    next(error);
  }
};

export const handleGetSlotById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slot = await getSlotById(req.user!.id, req.params.id as string);
    res.status(200).json({ slot });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slot = await updateSlot(req.user!.id, req.params.id as string, req.body);
    res.status(200).json({
      message: "Timetable slot updated successfully",
      slot,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await deleteSlot(req.user!.id, req.params.id as string);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGenerateSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesterId = req.body?.semesterId as string | undefined;
    const summary = await generateSemesterSessions(req.user!.id, semesterId);
    res.status(200).json({
      message: "Class sessions generated successfully",
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCsvTemplate = (
  _req: Request,
  res: Response
): void => {
  const csvContent = getTimetableCsvTemplate();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="attendwise_timetable_template.csv"'
  );
  res.status(200).send(csvContent);
};

export const handleImportCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { csvContent, semesterId } = req.body;
    const result = await importTimetableCsv(req.user!.id, csvContent, semesterId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
