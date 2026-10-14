import { Router } from "express";
import {
  handleCreateSubject,
  handleDeleteSubject,
  handleGetSubjectById,
  handleGetSubjects,
  handleUpdateSubject,
} from "../controllers/subject.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.js";
import {
  createSubjectSchema,
  updateSubjectSchema,
} from "../schemas/subject.schema.js";

const router = Router();

router.use(authenticate);

router.post("/", validateRequest(createSubjectSchema), handleCreateSubject);
router.get("/", handleGetSubjects);
router.get("/:id", handleGetSubjectById);
router.put("/:id", validateRequest(updateSubjectSchema), handleUpdateSubject);
router.delete("/:id", handleDeleteSubject);

export default router;
