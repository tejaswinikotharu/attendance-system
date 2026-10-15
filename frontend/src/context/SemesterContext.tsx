import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import { Semester } from "../types";
import { useAuth } from "./AuthContext";

interface SemesterContextType {
  semesters: Semester[];
  selectedSemesterId: string | null;
  selectedSemester: Semester | null;
  isLoading: boolean;
  setSelectedSemesterId: (id: string | null) => void;
  refreshSemesters: () => Promise<void>;
}

const SemesterContext = createContext<SemesterContextType | undefined>(undefined);

export const SemesterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshSemesters = async () => {
    if (!isAuthenticated) {
      setSemesters([]);
      setSelectedSemesterId(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.getSemesters();
      const list = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.semesters)
        ? (res as any).semesters
        : [];
      setSemesters(list);
      // Auto-select current semester or first semester if none selected
      if (!selectedSemesterId || !list.some((s: Semester) => s.id === selectedSemesterId)) {
        const current = list.find((s: Semester) => s.isCurrent) || list[0] || null;
        setSelectedSemesterId(current ? current.id : null);
      }
    } catch {
      setSemesters([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshSemesters();
    } else {
      setSemesters([]);
      setSelectedSemesterId(null);
    }
  }, [isAuthenticated]);

  const safeSemesters = Array.isArray(semesters) ? semesters : [];
  const selectedSemester =
    safeSemesters.find((s) => s.id === selectedSemesterId) || null;

  return (
    <SemesterContext.Provider
      value={{
        semesters,
        selectedSemesterId,
        selectedSemester,
        isLoading,
        setSelectedSemesterId,
        refreshSemesters,
      }}
    >
      {children}
    </SemesterContext.Provider>
  );
};

export const useSemester = (): SemesterContextType => {
  const context = useContext(SemesterContext);
  if (!context) {
    throw new Error("useSemester must be used within a SemesterProvider");
  }
  return context;
};
