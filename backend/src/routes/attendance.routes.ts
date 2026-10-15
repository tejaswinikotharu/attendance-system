import { Router } from "express";
import {
  handleExportAttendanceCsv,
  handleGetAttendanceHistory,
  handleGetDailyAttendance,
  handleGetSessionAttendance,
  handleMarkAttendance,
  handleUpdateAttendance,
} from "../controllers/attendance.controller.js";
import {
  handleCommitHistoricalImport,
  handleDeleteHistoricalBaseline,
  handleGetHistoricalCsvTemplate,
  handleGetSemesterHistoricalBaselines,
  handlePreviewHistoricalImport,
} from "../controllers/historicalAttendance.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.js";
import {
  markAttendanceSchema,
  updateAttendanceSchema,
} from "../schemas/attendance.schema.js";
import {
  historicalImportCommitSchema,
  historicalImportPreviewSchema,
} from "../schemas/historicalAttendance.schema.js";

const router = Router();

// CSV Template endpoint (authenticated)
router.get("/historical-template-csv", authenticate, handleGetHistoricalCsvTemplate);
router.get("/historical/template-csv", authenticate, handleGetHistoricalCsvTemplate);

// All attendance endpoints require authentication
router.use(authenticate);

// Historical Attendance Import Endpoints
router.get("/historical", handleGetSemesterHistoricalBaselines);
router.post(
  "/historical/preview",
  validateRequest(historicalImportPreviewSchema),
  handlePreviewHistoricalImport
);
router.post(
  "/historical/import",
  validateRequest(historicalImportCommitSchema),
  handleCommitHistoricalImport
);
router.delete("/historical/:subjectId", handleDeleteHistoricalBaseline);

// Session Attendance Endpoints
router.get("/daily", handleGetDailyAttendance);
router.get("/today", handleGetDailyAttendance);
router.post("/mark", validateRequest(markAttendanceSchema), handleMarkAttendance);
router.put("/:sessionId", validateRequest(updateAttendanceSchema), handleUpdateAttendance);
router.get("/sessions/:sessionId", handleGetSessionAttendance);
router.get("/history", handleGetAttendanceHistory);
router.get("/export-csv", handleExportAttendanceCsv);

export default router;
