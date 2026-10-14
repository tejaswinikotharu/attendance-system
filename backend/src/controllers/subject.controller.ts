import { NextFunction, Request, Response } from "express";
import {
  createSubject,
  deleteSubject,
  getSubjectById,
  getUserSubjects,
  updateSubject,
} from "../services/subject.service.js";

export const handleCreateSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subject = await createSubject(req.user!.id, req.body);
    res.status(201).json({
      message: "Subject created successfully",
      subject,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const semesterId = req.query.semesterId as string | undefined;
    const subjects = await getUserSubjects(req.user!.id, semesterId);
    res.status(200).json({ subjects });
  } catch (error) {
    next(error);
  }
};

export const handleGetSubjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subject = await getSubjectById(req.user!.id, req.params.id as string);
    res.status(200).json({ subject });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subject = await updateSubject(
      req.user!.id,
      req.params.id as string,
      req.body
    );
    res.status(200).json({
      message: "Subject updated successfully",
      subject,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await deleteSubject(req.user!.id, req.params.id as string);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
