import { NextFunction, Request, Response } from "express";
import {
  commitHistoricalImport,
  deleteHistoricalBaseline,
  getHistoricalAttendanceCsvTemplate,
  getSemesterHistoricalBaselines,
  previewHistoricalImport,
} from "../services/historicalAttendance.service.js";

export const handleGetHistoricalCsvTemplate = (
  _req: Request,
  res: Response
): void => {
  const template = getHistoricalAttendanceCsvTemplate();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="attendwise_historical_attendance_template.csv"'
  );
  res.status(200).send(template);
};

export const handlePreviewHistoricalImport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await previewHistoricalImport(req.user!.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleCommitHistoricalImport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await commitHistoricalImport(req.user!.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGetSemesterHistoricalBaselines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesterId = req.query.semesterId as string | undefined;
    const result = await getSemesterHistoricalBaselines(req.user!.id, semesterId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleDeleteHistoricalBaseline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const result = await deleteHistoricalBaseline(req.user!.id, subjectId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
