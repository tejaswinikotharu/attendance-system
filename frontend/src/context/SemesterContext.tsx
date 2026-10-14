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
      const list = await api.getSemesters();
      setSemesters(list);
      // Auto-select current semester or first semester if none selected
      if (!selectedSemesterId || !list.some((s) => s.id === selectedSemesterId)) {
        const current = list.find((s) => s.isCurrent) || list[0] || null;
        setSelectedSemesterId(current ? current.id : null);
      }
    } catch {
      // Error handled silently or by query
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

  const selectedSemester =
    semesters.find((s) => s.id === selectedSemesterId) || null;

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
