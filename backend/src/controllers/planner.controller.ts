import { NextFunction, Request, Response } from "express";
import {
  getRecoveryPlan,
  getSemesterForecasts,
  getSemesterPlannerSubjects,
  simulateAttendanceScenario,
} from "../services/planner.service.js";

export const handleGetPlannerSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesterId = req.query.semesterId as string | undefined;
    const result = await getSemesterPlannerSubjects(req.user!.id, semesterId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleSimulateAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await simulateAttendanceScenario(req.user!.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGetSemesterForecasts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as any;
    const result = await getSemesterForecasts(req.user!.id, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGetRecoveryPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesterId = req.query.semesterId as string | undefined;
    const result = await getRecoveryPlan(req.user!.id, semesterId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
