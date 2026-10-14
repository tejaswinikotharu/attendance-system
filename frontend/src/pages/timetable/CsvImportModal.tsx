import React, { useState } from "react";
import { Download, Upload, FileText, CheckCircle2 } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { api } from "../../api/client";
import { useToast } from "../../components/ui/Toast";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  semesterId: string;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  semesterId,
}) => {
  const toast = useToast();
  const [csvText, setCsvText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    subjects: number;
    slots: number;
    sessions: number;
  } | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const csv = await api.downloadCsvTemplate();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "attendwise_timetable_template.csv");
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
      setCsvText(content || "");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      toast.error("Please paste or upload CSV content");
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.importCsv(csvText, semesterId);
      setResult({
        subjects: res.createdSubjectsCount,
        slots: res.createdSlotsCount,
        sessions: res.generatedSessionsCount || 0,
      });
      toast.success(res.message || "Timetable imported successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to import CSV");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    setResult(null);
    setCsvText("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleFinish}
      title="Import Timetable from CSV"
      description="Quickly import your entire weekly class schedule using our standard CSV format."
      maxWidth="lg"
    >
      {result ? (
        <div className="py-6 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Import Completed Successfully
          </h3>
          <div className="flex justify-center gap-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl">
            <div>
              <p className="font-bold text-slate-900 text-sm">{result.subjects}</p>
              <p>Subjects created</p>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{result.slots}</p>
              <p>Timetable slots</p>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{result.sessions}</p>
              <p>Sessions generated</p>
            </div>
          </div>
          <Button size="sm" onClick={handleFinish}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action to download CSV template */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-indigo-950">
                  Standard Template
                </p>
                <p className="text-[11px] text-indigo-700">
                  Format: Subject Name, Code, Day, Start Time, End Time, Room, Professor
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="bg-white shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </Button>
          </div>

          {/* File Picker or Paste Area */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Upload CSV file
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-indigo-400 hover:bg-slate-50/50 transition-colors">
              <Upload className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-medium text-slate-700">
                Choose .csv file to upload
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="csv-textarea"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Or paste CSV content directly
            </label>
            <textarea
              id="csv-textarea"
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Subject Name,Code,DayOfWeek,StartTime,EndTime,Room,Professor&#10;Data Structures,CS201,MONDAY,09:00,10:00,Lab 1,Dr. Knuth"
              className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              isLoading={isLoading}
              disabled={!csvText.trim()}
            >
              Import Timetable
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
