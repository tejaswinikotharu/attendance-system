import { Router } from "express";
import {
  handleCreateSemester,
  handleDeleteSemester,
  handleGetCurrentSemester,
  handleGetSemesterById,
  handleGetSemesters,
  handleUpdateSemester,
} from "../controllers/semester.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.js";
import {
  createSemesterSchema,
  updateSemesterSchema,
} from "../schemas/semester.schema.js";

const router = Router();

// All semester routes require authentication
router.use(authenticate);

router.post("/", validateRequest(createSemesterSchema), handleCreateSemester);
router.get("/", handleGetSemesters);
router.get("/current", handleGetCurrentSemester);
router.get("/:id", handleGetSemesterById);
router.put("/:id", validateRequest(updateSemesterSchema), handleUpdateSemester);
router.delete("/:id", handleDeleteSemester);

export default router;
