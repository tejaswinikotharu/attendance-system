import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../components/ui/Toast";
import { api, setAuthToken, getAuthToken } from "../api/client";

// Mock api
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<any>("../api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      login: vi.fn(),
      register: vi.fn(),
    },
  };
});

describe("Authentication Pages & Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthToken(null);
  });

  it("validates required fields on login submit", async () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it("validates password length and match on register submit", async () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    const fullNameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitBtn = screen.getByRole("button", { name: /create account/i });

    await userEvent.type(fullNameInput, "A");
    await userEvent.type(emailInput, "invalid-email");
    await userEvent.type(passwordInput, "short");
    await userEvent.type(confirmPasswordInput, "different");
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/full name must be at least 2 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("successfully signs in and stores token in-memory only", async () => {
    const mockUser = {
      id: "u1",
      email: "student@college.edu",
      fullName: "Alex Johnson",
    };
    (api.login as any).mockResolvedValue({
      user: mockUser,
      token: "mock-jwt-token-12345",
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    await userEvent.type(screen.getByLabelText(/email address/i), "student@college.edu");
    await userEvent.type(screen.getByLabelText(/password/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        email: "student@college.edu",
        password: "Password123",
      });
    });

    // In-memory token set, NOT in localStorage
    expect(getAuthToken()).toBe("mock-jwt-token-12345");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("displays useful validation message instead of generic 'Validation Error' when registration fails", async () => {
    const { ApiError } = await import("../api/client");
    (api.register as any).mockRejectedValue(
      new ApiError("Full name must be at least 2 characters", 400, [
        { field: "fullName", message: "Full name must be at least 2 characters" },
      ])
    );

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    await userEvent.type(screen.getByLabelText(/full name/i), "Alex Johnson");
    await userEvent.type(screen.getByLabelText(/email address/i), "alex@college.edu");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Password123");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    const alertBanner = await screen.findByRole("alert");
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent("Full name must be at least 2 characters");
    expect(alertBanner).not.toHaveTextContent(/^Validation Error$/);
  });

  it("displays server error message when account already exists (409 Conflict)", async () => {
    const { ApiError } = await import("../api/client");
    (api.register as any).mockRejectedValue(
      new ApiError("A student with this email address already exists.", 409)
    );

    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    await userEvent.type(screen.getByLabelText(/full name/i), "Alex Johnson");
    await userEvent.type(screen.getByLabelText(/email address/i), "alex@college.edu");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Password123");
    await userEvent.type(screen.getByLabelText(/confirm password/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    const alertBanner = await screen.findByRole("alert");
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent("A student with this email address already exists.");
  });
});
