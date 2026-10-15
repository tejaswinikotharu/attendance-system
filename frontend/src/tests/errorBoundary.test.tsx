import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../components/layout/ErrorBoundary";

const ProblemChild: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error("Simulated rendering explosion!");
  }
  return <div>Normal Content</div>;
};

describe("ErrorBoundary", () => {
  it("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal Content")).toBeInTheDocument();
  });

  it("catches runtime errors and displays fallback UI instead of blank screen", () => {
    // Suppress console.error in test output for simulated error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Custom View Error">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom View Error")).toBeInTheDocument();
    expect(screen.getByText("Simulated rendering explosion!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();

    spy.mockRestore();
  });
});
