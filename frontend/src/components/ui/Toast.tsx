import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => addToast("success", message, title),
    [addToast]
  );
  const error = useCallback(
    (message: string, title?: string) => addToast("error", message, title),
    [addToast]
  );
  const info = useCallback(
    (message: string, title?: string) => addToast("info", message, title),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg bg-white transition-all transform animate-in slide-in-from-bottom-2 ${
              toast.type === "success"
                ? "border-emerald-200 text-emerald-950"
                : toast.type === "error"
                ? "border-rose-200 text-rose-950"
                : "border-indigo-200 text-indigo-950"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            {toast.type === "info" && (
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="text-xs font-semibold leading-tight">{toast.title}</p>
              )}
              <p className="text-xs text-slate-600 mt-0.5 break-words">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss toast"
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
