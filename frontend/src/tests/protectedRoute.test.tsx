import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../components/layout/ProtectedRoute";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { setAuthToken } from "../api/client";

// Test component to simulate logged-in status
const AuthSetter: React.FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const { login } = useAuth();
  React.useEffect(() => {
    if (loggedIn) {
      setAuthToken("fake-token");
      // Trigger login mock if needed
    }
  }, [loggedIn, login]);
  return null;
};

describe("Protected Routes Behavior", () => {
  it("redirects unauthenticated users to /login", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page Screen</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Secret Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page Screen")).toBeInTheDocument();
    expect(screen.queryByText("Secret Dashboard Content")).not.toBeInTheDocument();
  });
});
