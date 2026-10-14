import { Router } from "express";
import {
  handleGetPlannerSubjects,
  handleGetRecoveryPlan,
  handleGetSemesterForecasts,
  handleSimulateAttendance,
} from "../controllers/planner.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.js";
import { simulateAttendanceSchema } from "../schemas/planner.schema.js";

const router = Router();

// All planner routes require authentication
router.use(authenticate);

router.get("/subjects", handleGetPlannerSubjects);
router.post("/simulate", validateRequest(simulateAttendanceSchema), handleSimulateAttendance);
router.get("/forecast", handleGetSemesterForecasts);
router.get("/recovery", handleGetRecoveryPlan);

export default router;
