import { NextFunction, Request, Response } from "express";
import {
  exportAttendanceCsv,
  getAttendanceHistory,
  getDailySessions,
  getSessionAttendance,
  markAttendance,
  updateAttendance,
} from "../services/attendance.service.js";

export const handleGetDailyAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dateStr = req.query.date as string | undefined;
    const semesterId = req.query.semesterId as string | undefined;
    const result = await getDailySessions(req.user!.id, dateStr, semesterId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleMarkAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await markAttendance(req.user!.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleUpdateAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.params.sessionId as string;
    const result = await updateAttendance(req.user!.id, sessionId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGetSessionAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.params.sessionId as string;
    const result = await getSessionAttendance(req.user!.id, sessionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGetAttendanceHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as any;
    const result = await getAttendanceHistory(req.user!.id, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleExportAttendanceCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as any;
    const csvContent = await exportAttendanceCsv(req.user!.id, query);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="attendwise_attendance_history.csv"'
    );
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
