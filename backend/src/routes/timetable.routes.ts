import { Router } from "express";
import {
  handleCreateSlot,
  handleDeleteSlot,
  handleGenerateSessions,
  handleGetCsvTemplate,
  handleGetSlotById,
  handleGetSlots,
  handleImportCsv,
  handleUpdateSlot,
} from "../controllers/timetable.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.js";
import {
  createTimetableSlotSchema,
  generateSessionsSchema,
  importCsvSchema,
  updateTimetableSlotSchema,
} from "../schemas/timetable.schema.js";

const router = Router();

// Public template download endpoint (or authenticated)
router.get("/template-csv", handleGetCsvTemplate);

// All other timetable routes require authentication
router.use(authenticate);

router.post("/slots", validateRequest(createTimetableSlotSchema), handleCreateSlot);
router.get("/slots", handleGetSlots);
router.get("/slots/:id", handleGetSlotById);
router.put("/slots/:id", validateRequest(updateTimetableSlotSchema), handleUpdateSlot);
router.delete("/slots/:id", handleDeleteSlot);

router.post("/generate", validateRequest(generateSessionsSchema), handleGenerateSessions);
router.post("/import-csv", validateRequest(importCsvSchema), handleImportCsv);

export default router;
