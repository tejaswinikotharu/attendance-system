import { AppError } from "../middleware/error.middleware.js";
import {
  HistoricalImportCommitInput,
  HistoricalImportPreviewInput,
} from "../schemas/historicalAttendance.schema.js";
import { getAuthorizedSemester, getAuthorizedSubject } from "../utils/authScope.js";
import { prisma } from "../utils/db.js";
import { getCurrentSemester } from "./semester.service.js";

const DEFAULT_SUBJECT_COLORS = [
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#059669", // Emerald
  "#D97706", // Amber
  "#DC2626", // Red
  "#0891B2", // Cyan
  "#4F46E5", // Indigo
  "#EA580C", // Orange
  "#0D9488", // Teal
  "#E11D48", // Rose
];

/**
 * Standard CSV Template with sample dataset specified in requirements.
 */
export function getHistoricalAttendanceCsvTemplate(): string {
  return [
    "subjectCode,subjectName,present,total",
    "CSEN3121,Adhoc and Sensor Networks,34,39",
    "VIVA3555,Comprehensive Examination,12,13",
    "CIVL2281,Disaster Management,35,39",
    "SOCY3071,Gender and Sexuality,29,38",
    "CSEN3051,Wireless Sensor Networks,36,39",
  ].join("\n");
}

export interface ParsedHistoricalRow {
  rowNumber: number;
  subjectCode: string;
  subjectName: string;
  present: number;
  total: number;
  absent: number;
  percentage: number | null;
  errors: string[];
  existsInSemester: boolean;
  hasExistingBaseline: boolean;
  willCreateSubject: boolean;
}

/**
 * Parses raw CSV string according to RFC 4180 rules.
 */
export function parseHistoricalAttendanceCsv(csvContent: string): {
  rows: Array<{
    rowNumber: number;
    subjectCode: string;
    subjectName: string;
    present: number;
    total: number;
    errors: string[];
  }>;
  globalErrors: string[];
} {
  const cleanedContent = csvContent.replace(/^\uFEFF/, "");
  const lines = cleanedContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const globalErrors: string[] = [];
  const rows: Array<{
    rowNumber: number;
    subjectCode: string;
    subjectName: string;
    present: number;
    total: number;
    errors: string[];
  }> = [];

  if (lines.length < 2) {
    globalErrors.push(
      "CSV must contain a header row ('subjectCode,subjectName,present,total') and at least one data row."
    );
    return { rows, globalErrors };
  }

  // Parse header
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, "").replace(/\s+|_/g, ""));

  const requiredCols = ["subjectcode", "subjectname", "present", "total"];
  for (const req of requiredCols) {
    if (!headers.includes(req)) {
      globalErrors.push(`Missing required column header: "${req}"`);
    }
  }

  if (globalErrors.length > 0) {
    return { rows, globalErrors };
  }

  const idxCode = headers.indexOf("subjectcode");
  const idxName = headers.indexOf("subjectname");
  const idxPresent = headers.indexOf("present");
  const idxTotal = headers.indexOf("total");

  const unquote = (val: string) => {
    let s = val.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
    }
    return s.trim();
  };

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const line = lines[i];

    // RFC 4180 comma split handling quoted strings and escaped double quotes
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        if (inQuotes && line[c + 1] === '"') {
          cur += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "'" && !inQuotes) {
        inQuotes = true;
      } else if (char === "'" && inQuotes) {
        inQuotes = false;
      } else if (char === "," && !inQuotes) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    cols.push(cur.trim());

    const rawCode = unquote(cols[idxCode] || "");
    const rawName = unquote(cols[idxName] || "");
    const rawPresent = unquote(cols[idxPresent] || "");
    const rawTotal = unquote(cols[idxTotal] || "");

    const rowErrors: string[] = [];

    if (!rawCode) {
      rowErrors.push("Subject code cannot be empty");
    }
    if (!rawName) {
      rowErrors.push("Subject name cannot be empty");
    }

    const presentNum = Number(rawPresent);
    const totalNum = Number(rawTotal);

    if (rawPresent === "" || isNaN(presentNum) || !Number.isInteger(presentNum) || presentNum < 0) {
      rowErrors.push("Present count must be a non-negative integer");
    }

    if (rawTotal === "" || isNaN(totalNum) || !Number.isInteger(totalNum) || totalNum <= 0) {
      rowErrors.push("Total conducted classes must be an integer greater than zero");
    } else if (!isNaN(presentNum) && presentNum > totalNum) {
      rowErrors.push(
        `Present count (${presentNum}) cannot exceed total conducted classes (${totalNum})`
      );
    }

    rows.push({
      rowNumber: rowNum,
      subjectCode: rawCode.toUpperCase(),
      subjectName: rawName,
      present: isNaN(presentNum) ? 0 : presentNum,
      total: isNaN(totalNum) ? 0 : totalNum,
      errors: rowErrors,
    });
  }

  return { rows, globalErrors };
}

/**
 * Validates and previews historical attendance rows before committing.
 * Identifies duplicate codes, invalid counts, and existing baselines.
 */
export async function previewHistoricalImport(
  userId: string,
  input: HistoricalImportPreviewInput
) {
  let targetSemesterId = input.semesterId;

  if (!targetSemesterId) {
    const active = await getCurrentSemester(userId);
    if (!active) {
      const error: AppError = new Error(
        "No active semester found. Please create or select a semester before importing attendance."
      );
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = active.id;
  }

  const semester = await getAuthorizedSemester(targetSemesterId, userId);

  let rawRows: Array<{
    rowNumber: number;
    subjectCode: string;
    subjectName: string;
    present: number;
    total: number;
    errors: string[];
  }> = [];

  const globalErrors: string[] = [];

  if (input.rawCsv && input.rawCsv.trim().length > 0) {
    const parsed = parseHistoricalAttendanceCsv(input.rawCsv);
    globalErrors.push(...parsed.globalErrors);
    rawRows = parsed.rows;
  } else if (input.items && Array.isArray(input.items) && input.items.length > 0) {
    rawRows = input.items.map((item, idx) => {
      const rowErrors: string[] = [];
      const code = item.subjectCode ? String(item.subjectCode).trim().toUpperCase() : "";
      const name = item.subjectName ? String(item.subjectName).trim() : "";
      const rawPresent = item.present;
      const rawTotal = item.total;

      const present = Number(rawPresent);
      const total = Number(rawTotal);

      if (!code) rowErrors.push("Subject code cannot be empty");
      if (!name) rowErrors.push("Subject name cannot be empty");

      if (
        rawPresent === undefined ||
        rawPresent === null ||
        String(rawPresent).trim() === "" ||
        isNaN(present) ||
        !Number.isInteger(present) ||
        present < 0
      ) {
        rowErrors.push("Present count must be a non-negative integer");
      }

      if (
        rawTotal === undefined ||
        rawTotal === null ||
        String(rawTotal).trim() === "" ||
        isNaN(total) ||
        !Number.isInteger(total) ||
        total <= 0
      ) {
        rowErrors.push("Total conducted classes must be greater than zero");
      } else if (
        rawPresent !== undefined &&
        rawPresent !== null &&
        String(rawPresent).trim() !== "" &&
        !isNaN(present) &&
        Number.isInteger(present) &&
        present >= 0 &&
        present > total
      ) {
        rowErrors.push(`Present count (${present}) cannot exceed total (${total})`);
      }

      return {
        rowNumber: idx + 1,
        subjectCode: code,
        subjectName: name,
        present: isNaN(present) ? 0 : present,
        total: isNaN(total) ? 0 : total,
        errors: rowErrors,
      };
    });
  } else {
    globalErrors.push("Please provide either CSV data or manual subject attendance rows.");
  }

  // Detect duplicate subject codes in the import payload
  const seenCodes = new Map<string, number[]>();
  for (const r of rawRows) {
    if (r.subjectCode) {
      const existing = seenCodes.get(r.subjectCode) || [];
      existing.push(r.rowNumber);
      seenCodes.set(r.subjectCode, existing);
    }
  }

  for (const [code, occurrences] of seenCodes.entries()) {
    if (occurrences.length > 1) {
      for (const r of rawRows) {
        if (r.subjectCode === code) {
          r.errors.push(
            `Duplicate subject code "${code}" detected across rows: ${occurrences.join(", ")}. Each subject code must appear at most once.`
          );
        }
      }
    }
  }

  // Fetch existing subjects in the target semester
  const existingSubjects = await prisma.subject.findMany({
    where: { semesterId: semester.id },
    include: { historicalAttendance: true },
  });

  const subjectMap = new Map(existingSubjects.map((s) => [s.code.toUpperCase(), s]));

  let totalPresent = 0;
  let totalConducted = 0;
  let conflictCount = 0;

  const evaluatedRows: ParsedHistoricalRow[] = rawRows.map((r) => {
    const existingSubject = subjectMap.get(r.subjectCode);
    const existsInSemester = Boolean(existingSubject);
    const hasExistingBaseline = Boolean(existingSubject?.historicalAttendance);
    const willCreateSubject = !existsInSemester;

    if (hasExistingBaseline) {
      conflictCount++;
    }

    const absent = Math.max(0, r.total - r.present);
    const percentage =
      r.total > 0 && r.present <= r.total
        ? Math.round((r.present / r.total) * 10000) / 100
        : null;

    if (r.errors.length === 0 && r.total > 0 && r.present <= r.total) {
      totalPresent += r.present;
      totalConducted += r.total;
    }

    return {
      rowNumber: r.rowNumber,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      present: r.present,
      total: r.total,
      absent,
      percentage,
      errors: r.errors,
      existsInSemester,
      hasExistingBaseline,
      willCreateSubject,
    };
  });

  const totalAbsent = Math.max(0, totalConducted - totalPresent);
  const overallPercentage =
    totalConducted > 0
      ? Math.round((totalPresent / totalConducted) * 10000) / 100
      : null;

  const hasRowErrors = evaluatedRows.some((r) => r.errors.length > 0);
  const isValid = globalErrors.length === 0 && !hasRowErrors && evaluatedRows.length > 0;

  return {
    isValid,
    targetSemester: {
      id: semester.id,
      name: semester.name,
      targetPercent: semester.targetPercent,
      startDate: semester.startDate,
      endDate: semester.endDate,
    },
    summary: {
      totalSubjects: evaluatedRows.length,
      validSubjectsCount: evaluatedRows.filter((r) => r.errors.length === 0).length,
      totalPresent,
      totalConducted,
      totalAbsent,
      overallPercentage,
    },
    conflictCount,
    globalErrors,
    rows: evaluatedRows,
  };
}

/**
 * Commits historical attendance import transactionally.
 * Creates missing subjects and attaches historical baseline.
 * Rejects duplicate codes or conflicting baselines unless overwriteExisting is true.
 */
export async function commitHistoricalImport(
  userId: string,
  input: HistoricalImportCommitInput
) {
  let targetSemesterId = input.semesterId;

  if (!targetSemesterId) {
    const active = await getCurrentSemester(userId);
    if (!active) {
      const error: AppError = new Error(
        "No active semester found. Please create or select a semester before importing attendance."
      );
      error.statusCode = 400;
      throw error;
    }
    targetSemesterId = active.id;
  }

  const semester = await getAuthorizedSemester(targetSemesterId, userId);

  if (!input.items || input.items.length === 0) {
    const error: AppError = new Error("Import payload contains no subject attendance rows.");
    error.statusCode = 400;
    throw error;
  }

  // 1. Check duplicate subject codes in payload
  const seenCodes = new Set<string>();
  for (const item of input.items) {
    const code = item.subjectCode.trim().toUpperCase();
    if (seenCodes.has(code)) {
      const error: AppError = new Error(
        `Duplicate subject code "${code}" found in import payload. Each subject code must be unique.`
      );
      error.statusCode = 400;
      throw error;
    }
    seenCodes.add(code);

    // Validate integer values
    if (item.present < 0 || !Number.isInteger(item.present)) {
      const error: AppError = new Error(
        `Invalid present count (${item.present}) for subject "${code}". Must be a non-negative integer.`
      );
      error.statusCode = 400;
      throw error;
    }
    if (item.total <= 0 || !Number.isInteger(item.total)) {
      const error: AppError = new Error(
        `Invalid total count (${item.total}) for subject "${code}". Total conducted must be greater than zero.`
      );
      error.statusCode = 400;
      throw error;
    }
    if (item.present > item.total) {
      const error: AppError = new Error(
        `Present count (${item.present}) exceeds total conducted classes (${item.total}) for subject "${code}".`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 2. Fetch existing subjects in the semester
  const existingSubjects = await prisma.subject.findMany({
    where: { semesterId: semester.id },
    include: { historicalAttendance: true },
  });

  const subjectMap = new Map(existingSubjects.map((s) => [s.code.toUpperCase(), s]));

  // 3. Check for conflicting baselines if overwriteExisting is false
  if (!input.overwriteExisting) {
    const conflictingCodes: string[] = [];
    for (const item of input.items) {
      const code = item.subjectCode.trim().toUpperCase();
      const existing = subjectMap.get(code);
      if (existing?.historicalAttendance) {
        conflictingCodes.push(`${code} (${existing.name})`);
      }
    }

    if (conflictingCodes.length > 0) {
      const error: AppError = new Error(
        `Historical attendance baseline already exists for: ${conflictingCodes.join(", ")}. ` +
          `To replace existing baselines, check 'Overwrite Existing Baseline'.`
      );
      error.statusCode = 409;
      throw error;
    }
  }

  // 4. Generate unique batch ID
  const batchId = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 5. Execute in database transaction
  const result = await prisma.$transaction(async (tx) => {
    const importedSubjects: Array<{
      subjectId: string;
      code: string;
      name: string;
      present: number;
      total: number;
      absent: number;
      percentage: number;
      wasCreated: boolean;
    }> = [];

    let totalPresent = 0;
    let totalConducted = 0;

    let colorIndex = existingSubjects.length;

    for (const item of input.items) {
      const code = item.subjectCode.trim().toUpperCase();
      const name = item.subjectName.trim();
      let subject = subjectMap.get(code);
      let wasCreated = false;

      if (!subject) {
        // Create the subject in this semester
        const assignedColor =
          DEFAULT_SUBJECT_COLORS[colorIndex % DEFAULT_SUBJECT_COLORS.length];
        colorIndex++;

        subject = await tx.subject.create({
          data: {
            semesterId: semester.id,
            code,
            name,
            color: assignedColor,
          },
          include: { historicalAttendance: true },
        });
        wasCreated = true;
      }

      // Upsert historical baseline for this subject
      await tx.historicalAttendance.upsert({
        where: { subjectId: subject.id },
        create: {
          semesterId: semester.id,
          subjectId: subject.id,
          present: item.present,
          total: item.total,
          batchId,
        },
        update: {
          present: item.present,
          total: item.total,
          batchId,
          updatedAt: new Date(),
        },
      });

      const absent = item.total - item.present;
      const percentage = Math.round((item.present / item.total) * 10000) / 100;

      totalPresent += item.present;
      totalConducted += item.total;

      importedSubjects.push({
        subjectId: subject.id,
        code,
        name: subject.name,
        present: item.present,
        total: item.total,
        absent,
        percentage,
        wasCreated,
      });
    }

    const totalAbsent = totalConducted - totalPresent;
    const overallPercentage =
      totalConducted > 0
        ? Math.round((totalPresent / totalConducted) * 10000) / 100
        : null;

    return {
      importedSubjects,
      summary: {
        totalSubjects: importedSubjects.length,
        totalPresent,
        totalConducted,
        totalAbsent,
        overallPercentage,
      },
    };
  });

  return {
    message: `Successfully imported historical attendance for ${result.importedSubjects.length} subject(s).`,
    batchId,
    semesterId: semester.id,
    importedCount: result.importedSubjects.length,
    summary: result.summary,
    subjects: result.importedSubjects,
  };
}

/**
 * Retrieves all historical attendance baselines for a semester.
 */
export async function getSemesterHistoricalBaselines(
  userId: string,
  semesterId?: string
) {
  let targetSemesterId = semesterId;

  if (!targetSemesterId) {
    const active = await getCurrentSemester(userId);
    if (!active) {
      return { semesterId: null, baselines: [] };
    }
    targetSemesterId = active.id;
  }

  await getAuthorizedSemester(targetSemesterId, userId);

  const baselines = await prisma.historicalAttendance.findMany({
    where: { semesterId: targetSemesterId },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
    },
    orderBy: { subject: { code: "asc" } },
  });

  return {
    semesterId: targetSemesterId,
    baselines: baselines.map((b) => ({
      id: b.id,
      subjectId: b.subjectId,
      subjectCode: b.subject.code,
      subjectName: b.subject.name,
      color: b.subject.color,
      present: b.present,
      total: b.total,
      absent: Math.max(0, b.total - b.present),
      percentage: Math.round((b.present / b.total) * 10000) / 100,
      batchId: b.batchId,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
  };
}

/**
 * Deletes an existing historical attendance baseline for a subject.
 */
export async function deleteHistoricalBaseline(userId: string, subjectId: string) {
  const subject = await getAuthorizedSubject(subjectId, userId);

  const baseline = await prisma.historicalAttendance.findUnique({
    where: { subjectId: subject.id },
  });

  if (!baseline) {
    const error: AppError = new Error("Historical attendance baseline not found for this subject.");
    error.statusCode = 404;
    throw error;
  }

  await prisma.historicalAttendance.delete({
    where: { subjectId: subject.id },
  });

  return {
    message: `Historical baseline for subject ${subject.code} deleted successfully.`,
    subjectId: subject.id,
  };
}
