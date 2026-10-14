import { NextFunction, Request, Response } from "express";
import {
  createSemester,
  deleteSemester,
  getCurrentSemester,
  getSemesterById,
  getUserSemesters,
  updateSemester,
} from "../services/semester.service.js";

export const handleCreateSemester = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semester = await createSemester(req.user!.id, req.body);
    res.status(201).json({
      message: "Semester created successfully",
      semester,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSemesters = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesters = await getUserSemesters(req.user!.id);
    res.status(200).json({ semesters });
  } catch (error) {
    next(error);
  }
};

export const handleGetCurrentSemester = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semester = await getCurrentSemester(req.user!.id);
    res.status(200).json({ semester });
  } catch (error) {
    next(error);
  }
};

export const handleGetSemesterById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semester = await getSemesterById(req.user!.id, req.params.id as string);
    res.status(200).json({ semester });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateSemester = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semester = await updateSemester(
      req.user!.id,
      req.params.id as string,
      req.body
    );
    res.status(200).json({
      message: "Semester updated successfully",
      semester,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteSemester = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await deleteSemester(req.user!.id, req.params.id as string);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
