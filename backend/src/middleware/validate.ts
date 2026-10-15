import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        const combinedMessage = issues.map((i) => i.message).join(", ") || "Validation Error";
        res.status(400).json({
          error: "Validation Error",
          message: combinedMessage,
          issues,
        });
        return;
      }
      next(error);
    }
  };
};
