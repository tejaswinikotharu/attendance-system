import { NextFunction, Request, Response } from "express";
import {
  getCurrentStudent,
  loginStudent,
  registerStudent,
} from "../services/auth.service.js";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await registerStudent(req.body);
    res.status(201).json({
      message: "Registration successful",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await loginStudent(req.body);
    res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const student = await getCurrentStudent(req.user.id);
    res.status(200).json({
      user: student,
    });
  } catch (error) {
    next(error);
  }
};
