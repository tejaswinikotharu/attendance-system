import React, { useState } from "react";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  Info,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { api } from "../../api/client";
import { useToast } from "../ui/Toast";
import { HistoricalImportPreviewResponse } from "../../types";

interface ManualRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  present: string;
  total: string;
}

interface HistoricalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  semesterId: string;
  semesterName?: string;
}

const SAMPLE_ROWS: ManualRow[] = [
  { id: "1", subjectCode: "CSEN3121", subjectName: "Adhoc and Sensor Networks", present: "34", total: "39" },
  { id: "2", subjectCode: "VIVA3555", subjectName: "Comprehensive Examination", present: "12", total: "13" },
  { id: "3", subjectCode: "CIVL2281", subjectName: "Disaster Management", present: "35", total: "39" },
  { id: "4", subjectCode: "SOCY3071", subjectName: "Gender and Sexuality", present: "29", total: "38" },
  { id: "5", subjectCode: "CSEN3051", subjectName: "Wireless Sensor Networks", present: "36", total: "39" },
];

export const HistoricalImportModal: React.FC<HistoricalImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  semesterId,
  semesterName,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"manual" | "csv">("manual");
  const [step, setStep] = useState<"input" | "preview" | "success">("input");

  // Manual rows state
  const [manualRows, setManualRows] = useState<ManualRow[]>([
    { id: "1", subjectCode: "", subjectName: "", present: "", total: "" },
  ]);

  // CSV state
  const [csvContent, setCsvContent] = useState<string>("");

  // Preview & commit state
  const [previewData, setPreviewData] = useState<HistoricalImportPreviewResponse | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitSummary, setCommitSummary] = useState<any>(null);

  const resetModalState = () => {
    setStep("input");
    setPreviewData(null);
    setCommitSummary(null);
    setOverwriteExisting(false);
    setIsLoading(false);
    setIsCommitting(false);
  };

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleAddManualRow = () => {
    setManualRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        subjectCode: "",
        subjectName: "",
        present: "",
        total: "",
      },
    ]);
  };

  const handleRemoveManualRow = (id: string) => {
    if (manualRows.length <= 1) {
      setManualRows([{ id: "1", subjectCode: "", subjectName: "", present: "", total: "" }]);
      return;
    }
    setManualRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleManualRowChange = (id: string, field: keyof ManualRow, value: string) => {
    setManualRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "subjectCode") {
          return { ...r, subjectCode: value.toUpperCase() };
        }
        return { ...r, [field]: value };
      })
    );
  };

  const handleLoadSampleDataset = () => {
    setManualRows(SAMPLE_ROWS);
    setCsvContent(
      [
        "subjectCode,subjectName,present,total",
        "CSEN3121,Adhoc and Sensor Networks,34,39",
        "VIVA3555,Comprehensive Examination,12,13",
        "CIVL2281,Disaster Management,35,39",
        "SOCY3071,Gender and Sexuality,29,38",
        "CSEN3051,Wireless Sensor Networks,36,39",
      ].join("\n")
    );
    toast.info("Sample dataset loaded (146/168 classes, ~86.90%)");
  };

  const handleDownloadTemplate = async () => {
    try {
      const template = await api.downloadHistoricalCsvTemplate();
      const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "attendwise_historical_attendance_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV template downloaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download template");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content || "");
    };
    reader.readAsText(file);
  };

  const handleGeneratePreview = async () => {
    setIsLoading(true);
    try {
      let previewResult: HistoricalImportPreviewResponse;

      if (activeTab === "csv") {
        if (!csvContent.trim()) {
          toast.error("Please paste or upload CSV content before previewing");
          setIsLoading(false);
          return;
        }
        previewResult = await api.previewHistoricalImport({
          semesterId,
          rawCsv: csvContent,
        });
      } else {
        const filledRows = manualRows.filter(
          (r) => r.subjectCode.trim() || r.subjectName.trim() || r.present || r.total
        );
        if (filledRows.length === 0) {
          toast.error("Please enter at least one subject attendance row");
          setIsLoading(false);
          return;
        }

        const items = filledRows.map((r) => ({
          subjectCode: r.subjectCode.trim(),
          subjectName: r.subjectName.trim(),
          present: Number(r.present),
          total: Number(r.total),
        }));

        previewResult = await api.previewHistoricalImport({
          semesterId,
          items,
        });
      }

      setPreviewData(previewResult);
      setStep("preview");
      if (!previewResult.isValid) {
        toast.error("Some rows contain validation errors. Review them below.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewData || !previewData.isValid) {
      toast.error("Cannot commit import with validation errors");
      return;
    }

    setIsCommitting(true);
    try {
      const itemsToImport = previewData.rows.map((r) => ({
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        present: r.present,
        total: r.total,
      }));

      const res = await api.commitHistoricalImport({
        semesterId,
        items: itemsToImport,
        overwriteExisting,
      });

      setCommitSummary(res);
      setStep("success");
      toast.success(res.message || "Historical attendance imported successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to import historical attendance");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Existing Attendance"
      description={
        semesterName
          ? `Import subject-wise historical totals for ${semesterName}`
          : "Establish your pre-AttendWise attendance baseline without fabricating past session dates"
      }
      maxWidth="2xl"
    >
      {/* Step 1: Input (Manual or CSV) */}
      {step === "input" && (
        <div className="space-y-4">
          {/* Method Selector Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === "manual"
                    ? "bg-indigo-50 text-indigo-700 font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Manual Entry Table
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("csv")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === "csv"
                    ? "bg-indigo-50 text-indigo-700 font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                CSV Upload / Paste
              </button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleLoadSampleDataset}
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              Load Sample Dataset
            </Button>
          </div>

          {/* Tab 1: Manual Entry */}
          {activeTab === "manual" && (
            <div className="space-y-3">
              <div className="max-h-[340px] overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Subject Code *</th>
                      <th className="py-2.5 px-3">Subject Name *</th>
                      <th className="py-2.5 px-2 w-20">Attended *</th>
                      <th className="py-2.5 px-2 w-20">Total *</th>
                      <th className="py-2.5 px-2 w-16 text-slate-400">Absent</th>
                      <th className="py-2.5 px-2 w-20 text-slate-400">%</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {manualRows.map((row) => {
                      const presentNum = Number(row.present);
                      const totalNum = Number(row.total);
                      const isValidPresent = row.present !== "" && !isNaN(presentNum) && presentNum >= 0;
                      const isValidTotal = row.total !== "" && !isNaN(totalNum) && totalNum > 0;
                      const absent =
                        isValidPresent && isValidTotal ? Math.max(0, totalNum - presentNum) : "—";
                      const pct =
                        isValidPresent && isValidTotal && totalNum > 0
                          ? `${((presentNum / totalNum) * 100).toFixed(1)}%`
                          : "—";

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.subjectCode}
                              onChange={(e) =>
                                handleManualRowChange(row.id, "subjectCode", e.target.value)
                              }
                              placeholder="e.g. CSEN3121"
                              className="w-full text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.subjectName}
                              onChange={(e) =>
                                handleManualRowChange(row.id, "subjectName", e.target.value)
                              }
                              placeholder="e.g. Adhoc Networks"
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={row.present}
                              onChange={(e) =>
                                handleManualRowChange(row.id, "present", e.target.value)
                              }
                              placeholder="34"
                              className="w-full text-xs text-center font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={row.total}
                              onChange={(e) =>
                                handleManualRowChange(row.id, "total", e.target.value)
                              }
                              placeholder="39"
                              className="w-full text-xs text-center font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2 text-center text-slate-500 font-mono text-[11px]">
                            {absent}
                          </td>
                          <td className="p-2 text-center font-mono font-semibold text-indigo-600 text-[11px]">
                            {pct}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveManualRow(row.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddManualRow}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Subject Row
                </Button>
                <span className="text-[11px] text-slate-400">
                  {manualRows.length} subject row{manualRows.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: CSV Upload & Paste */}
          {activeTab === "csv" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">CSV Template Format</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    subjectCode,subjectName,present,total
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="text-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download Template
                </Button>
              </div>

              {/* Upload Input */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Upload CSV File
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Choose File (.csv)</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-400">or paste content directly below</span>
                </div>
              </div>

              {/* Raw CSV Text Area */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  CSV Raw Data
                </label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={`subjectCode,subjectName,present,total\nCSEN3121,Adhoc and Sensor Networks,34,39\nVIVA3555,Comprehensive Examination,12,13`}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Informational Callout */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Aggregate Baseline Policy</p>
              <p className="mt-0.5 text-amber-700 leading-relaxed text-[11px]">
                Imported counts represent verified historical class totals before using AttendWise.
                Because aggregate totals do not provide individual session dates, AttendWise will not
                fabricate dates. These counts are combined with future class sessions exactly once.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button size="sm" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGeneratePreview}
              isLoading={isLoading}
            >
              <span>Preview Import</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Validation Results */}
      {step === "preview" && previewData && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Total Subjects
              </span>
              <span className="text-lg font-bold text-slate-800">
                {previewData.summary.totalSubjects}
              </span>
            </div>
            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 block">
                Attended Classes
              </span>
              <span className="text-lg font-bold text-emerald-700 font-mono">
                {previewData.summary.totalPresent}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                Conducted Classes
              </span>
              <span className="text-lg font-bold text-slate-800 font-mono">
                {previewData.summary.totalConducted}
              </span>
            </div>
            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
              <span className="text-[10px] uppercase font-semibold text-indigo-600 block">
                Overall Attendance
              </span>
              <span className="text-lg font-bold text-indigo-700 font-mono">
                {previewData.summary.overallPercentage !== null
                  ? `${previewData.summary.overallPercentage.toFixed(2)}%`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Global / Row Errors Notice */}
          {(!previewData.isValid || previewData.globalErrors.length > 0) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Validation Errors Detected</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Please fix the invalid rows before committing. Look for highlighted issues below.
                </p>
                {previewData.globalErrors.map((err, i) => (
                  <p key={i} className="text-[11px] font-medium text-rose-800 mt-1">
                    • {err}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Existing Baseline Conflict Alert */}
          {previewData.conflictCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">
                    Existing Historical Baseline Found ({previewData.conflictCount} subject{previewData.conflictCount > 1 ? "s" : ""})
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    One or more subjects already have an imported baseline in this semester.
                    To prevent accidental duplicate imports, updating requires explicit confirmation.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 font-medium text-xs text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Overwrite existing baseline for matching subjects</span>
              </label>
            </div>
          )}

          {/* Preview Table */}
          <div className="max-h-[260px] overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-2 text-center">Attended</th>
                  <th className="py-2.5 px-2 text-center">Conducted</th>
                  <th className="py-2.5 px-2 text-center">Absent</th>
                  <th className="py-2.5 px-2 text-center">%</th>
                  <th className="py-2.5 px-3">Status / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {previewData.rows.map((row) => {
                  const hasError = row.errors.length > 0;

                  return (
                    <tr
                      key={row.rowNumber}
                      className={hasError ? "bg-rose-50/50" : "hover:bg-slate-50/50"}
                    >
                      <td className="p-2.5">
                        <p className="font-semibold text-slate-900">{row.subjectName}</p>
                        <span className="text-[10px] font-mono uppercase text-slate-500">
                          {row.subjectCode}
                        </span>
                      </td>
                      <td className="p-2 text-center font-mono font-medium text-slate-800">
                        {row.present}
                      </td>
                      <td className="p-2 text-center font-mono font-medium text-slate-800">
                        {row.total}
                      </td>
                      <td className="p-2 text-center font-mono text-slate-500 text-[11px]">
                        {row.absent}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-indigo-600">
                        {row.percentage !== null ? `${row.percentage.toFixed(1)}%` : "—"}
                      </td>
                      <td className="p-2.5">
                        {hasError ? (
                          <div className="space-y-0.5">
                            {row.errors.map((e, idx) => (
                              <span
                                key={idx}
                                className="inline-block text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        ) : row.hasExistingBaseline ? (
                          <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                            Has Existing Baseline
                          </span>
                        ) : row.existsInSemester ? (
                          <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            Matches Existing Subject
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                            Will Create Subject
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Confirmation Notice */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            By confirming, these counts will be stored as the historical attendance baseline for this semester.
            Dashboard summaries, safe bunks, recovery plans, and forecasts will immediately reflect this baseline.
          </p>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStep("input")}
            >
              Back to Edit
            </Button>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCommitImport}
                disabled={!previewData.isValid || (previewData.conflictCount > 0 && !overwriteExisting)}
                isLoading={isCommitting}
              >
                <span>Confirm & Import Baseline</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success Confirmation */}
      {step === "success" && commitSummary && (
        <div className="py-8 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Historical Attendance Imported Successfully!
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {commitSummary.summary.totalSubjects} subjects imported with a baseline of{" "}
              {commitSummary.summary.totalPresent} attended out of {commitSummary.summary.totalConducted}{" "}
              conducted classes ({commitSummary.summary.overallPercentage?.toFixed(2)}%).
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-w-sm mx-auto text-left text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Batch ID:</span>
              <span className="font-mono text-slate-800">{commitSummary.batchId}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Attended:</span>
              <span className="font-semibold text-emerald-600 font-mono">
                {commitSummary.summary.totalPresent}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Conducted:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {commitSummary.summary.totalConducted}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Overall Baseline %:</span>
              <span className="font-bold text-indigo-600 font-mono">
                {commitSummary.summary.overallPercentage?.toFixed(2)}%
              </span>
            </div>
          </div>

          <Button size="sm" onClick={handleClose}>
            Done & View Dashboard
          </Button>
        </div>
      )}
    </Modal>
  );
};
