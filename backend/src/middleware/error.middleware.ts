import { NextFunction, Request, Response } from "express";

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (statusCode >= 500) {
    console.error("Internal Application Error:", err);
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal Server Error" : err.name || "Error",
    message: statusCode === 500 && isProduction ? "An unexpected server error occurred." : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
