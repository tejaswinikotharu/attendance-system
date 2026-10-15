import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { SemesterProvider } from "./context/SemesterContext";
import { ToastProvider } from "./components/ui/Toast";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { TimetablePage } from "./pages/timetable/TimetablePage";
import { DailyAttendancePage } from "./pages/attendance/DailyAttendancePage";
import { HistoryPage } from "./pages/history/HistoryPage";
import { BunkPlannerPage } from "./pages/planner/BunkPlannerPage";

import { ErrorBoundary } from "./components/layout/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <SemesterProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public Auth Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Authenticated Dashboard & Feature Routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <ErrorBoundary fallbackTitle="An error occurred in this view">
                          <AppLayout />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="timetable" element={<TimetablePage />} />
                    <Route path="attendance" element={<DailyAttendancePage />} />
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="planner" element={<BunkPlannerPage />} />
                  </Route>

                  {/* Fallback route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </SemesterProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
