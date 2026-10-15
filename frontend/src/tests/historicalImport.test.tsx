import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoricalImportModal } from "../components/attendance/HistoricalImportModal";
import { ToastProvider } from "../components/ui/Toast";
import { api } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<any>("../api/client");
  return {
    ...actual,
    api: {
      previewHistoricalImport: vi.fn(),
      commitHistoricalImport: vi.fn(),
      downloadHistoricalCsvTemplate: vi.fn(),
    },
  };
});

const renderModal = (props: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  semesterId: string;
  semesterName?: string;
}) => {
  return render(
    <ToastProvider>
      <HistoricalImportModal {...props} />
    </ToastProvider>
  );
};

describe("Historical Attendance Import Modal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    semesterId: "sem-test-123",
    semesterName: "Fall 2026",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal with manual entry table and tab switcher", () => {
    renderModal(defaultProps);

    expect(screen.getByText("Import Existing Attendance")).toBeInTheDocument();
    expect(screen.getByText("Manual Entry Table")).toBeInTheDocument();
    expect(screen.getByText("CSV Upload / Paste")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load sample dataset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview import/i })).toBeInTheDocument();
  });

  it("switches to CSV upload tab and displays CSV template information", async () => {
    renderModal(defaultProps);

    const csvTabBtn = screen.getByText("CSV Upload / Paste");
    await userEvent.click(csvTabBtn);

    expect(screen.getByText("CSV Template Format")).toBeInTheDocument();
    expect(screen.getByText("subjectCode,subjectName,present,total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download template/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/subjectCode,subjectName,present,total/i)).toBeInTheDocument();
  });

  it("loads the sample dataset (146 present / 168 conducted = 86.90%) and previews it", async () => {
    (api.previewHistoricalImport as any).mockResolvedValue({
      isValid: true,
      targetSemester: {
        id: "sem-test-123",
        name: "Fall 2026",
        targetPercent: 75,
      },
      summary: {
        totalSubjects: 5,
        validSubjectsCount: 5,
        totalPresent: 146,
        totalConducted: 168,
        totalAbsent: 22,
        overallPercentage: 86.9,
      },
      conflictCount: 0,
      globalErrors: [],
      rows: [
        {
          rowNumber: 1,
          subjectCode: "CSEN3121",
          subjectName: "Adhoc and Sensor Networks",
          present: 34,
          total: 39,
          absent: 5,
          percentage: 87.18,
          errors: [],
          existsInSemester: false,
          hasExistingBaseline: false,
          willCreateSubject: true,
        },
        {
          rowNumber: 2,
          subjectCode: "VIVA3555",
          subjectName: "Comprehensive Examination",
          present: 12,
          total: 13,
          absent: 1,
          percentage: 92.31,
          errors: [],
          existsInSemester: false,
          hasExistingBaseline: false,
          willCreateSubject: true,
        },
        {
          rowNumber: 3,
          subjectCode: "CIVL2281",
          subjectName: "Disaster Management",
          present: 35,
          total: 39,
          absent: 4,
          percentage: 89.74,
          errors: [],
          existsInSemester: false,
          hasExistingBaseline: false,
          willCreateSubject: true,
        },
        {
          rowNumber: 4,
          subjectCode: "SOCY3071",
          subjectName: "Gender and Sexuality",
          present: 29,
          total: 38,
          absent: 9,
          percentage: 76.32,
          errors: [],
          existsInSemester: false,
          hasExistingBaseline: false,
          willCreateSubject: true,
        },
        {
          rowNumber: 5,
          subjectCode: "CSEN3051",
          subjectName: "Wireless Sensor Networks",
          present: 36,
          total: 39,
          absent: 3,
          percentage: 92.31,
          errors: [],
          existsInSemester: false,
          hasExistingBaseline: false,
          willCreateSubject: true,
        },
      ],
    });

    renderModal(defaultProps);

    // Click "Load Sample Dataset"
    const loadSampleBtn = screen.getByRole("button", { name: /load sample dataset/i });
    await userEvent.click(loadSampleBtn);

    // Verify sample inputs are populated
    expect(screen.getByDisplayValue("CSEN3121")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Adhoc and Sensor Networks")).toBeInTheDocument();
    expect(screen.getByDisplayValue("34")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("39")).toHaveLength(3);

    // Click "Preview Import"
    const previewBtn = screen.getByRole("button", { name: /preview import/i });
    await userEvent.click(previewBtn);

    await waitFor(() => {
      expect(api.previewHistoricalImport).toHaveBeenCalled();
    });

    // Verify preview step displays the exact combined totals
    expect(await screen.findByText("Attended Classes")).toBeInTheDocument();
    expect(screen.getByText("146")).toBeInTheDocument();
    expect(screen.getByText("168")).toBeInTheDocument();
    expect(screen.getByText("86.90%")).toBeInTheDocument();
    expect(screen.getByText("Confirm & Import Baseline")).toBeInTheDocument();
  });

  it("handles validation errors properly in preview and disables commit", async () => {
    (api.previewHistoricalImport as any).mockResolvedValue({
      isValid: false,
      summary: {
        totalSubjects: 1,
        validSubjectsCount: 0,
        totalPresent: 0,
        totalConducted: 0,
        totalAbsent: 0,
        overallPercentage: null,
      },
      conflictCount: 0,
      globalErrors: [],
      rows: [
        {
          rowNumber: 1,
          subjectCode: "BAD101",
          subjectName: "Invalid Counts",
          present: 15,
          total: 10,
          absent: 0,
          percentage: null,
          errors: ["Present count (15) cannot exceed total (10)"],
          existsInSemester: false,
          hasExistingBaseline: false,
          willCreateSubject: false,
        },
      ],
    });

    renderModal(defaultProps);

    // Populate a row
    const loadSampleBtn = screen.getByRole("button", { name: /load sample dataset/i });
    await userEvent.click(loadSampleBtn);

    const previewBtn = screen.getByRole("button", { name: /preview import/i });
    await userEvent.click(previewBtn);

    expect(await screen.findByText("Validation Errors Detected")).toBeInTheDocument();
    expect(screen.getByText("Present count (15) cannot exceed total (10)")).toBeInTheDocument();

    // Confirm button must be disabled
    const commitBtn = screen.getByRole("button", { name: /confirm & import baseline/i });
    expect(commitBtn).toBeDisabled();
  });

  it("requires overwrite confirmation when conflict with existing baseline is detected", async () => {
    (api.previewHistoricalImport as any).mockResolvedValue({
      isValid: true,
      summary: {
        totalSubjects: 1,
        validSubjectsCount: 1,
        totalPresent: 34,
        totalConducted: 39,
        totalAbsent: 5,
        overallPercentage: 87.18,
      },
      conflictCount: 1,
      globalErrors: [],
      rows: [
        {
          rowNumber: 1,
          subjectCode: "CSEN3121",
          subjectName: "Adhoc and Sensor Networks",
          present: 34,
          total: 39,
          absent: 5,
          percentage: 87.18,
          errors: [],
          existsInSemester: true,
          hasExistingBaseline: true,
          willCreateSubject: false,
        },
      ],
    });

    (api.commitHistoricalImport as any).mockResolvedValue({
      message: "Successfully imported historical attendance for 1 subject(s).",
      batchId: "hist_12345",
      semesterId: "sem-test-123",
      importedCount: 1,
      summary: {
        totalSubjects: 1,
        totalPresent: 34,
        totalConducted: 39,
        totalAbsent: 5,
        overallPercentage: 87.18,
      },
      subjects: [],
    });

    renderModal(defaultProps);

    // Populate a row
    const loadSampleBtn = screen.getByRole("button", { name: /load sample dataset/i });
    await userEvent.click(loadSampleBtn);

    const previewBtn = screen.getByRole("button", { name: /preview import/i });
    await userEvent.click(previewBtn);

    expect(await screen.findByText(/Existing Historical Baseline Found/i)).toBeInTheDocument();
    const commitBtn = screen.getByRole("button", { name: /confirm & import baseline/i });

    // Disabled initially because overwrite is not checked
    expect(commitBtn).toBeDisabled();

    // Check overwrite checkbox
    const checkbox = screen.getByRole("checkbox", {
      name: /overwrite existing baseline for matching subjects/i,
    });
    await userEvent.click(checkbox);

    // Commit button is now enabled
    expect(commitBtn).not.toBeDisabled();
    await userEvent.click(commitBtn);

    await waitFor(() => {
      expect(api.commitHistoricalImport).toHaveBeenCalledWith({
        semesterId: "sem-test-123",
        items: [
          {
            subjectCode: "CSEN3121",
            subjectName: "Adhoc and Sensor Networks",
            present: 34,
            total: 39,
          },
        ],
        overwriteExisting: true,
      });
    });

    // Success view is displayed
    expect(await screen.findByText(/Historical Attendance Imported Successfully!/i)).toBeInTheDocument();
    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });
});
