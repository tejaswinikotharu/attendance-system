import React from "react";
import { twMerge } from "tailwind-merge";

interface ProgressBarProps {
  percentage: number | null | undefined;
  target?: number;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  target = 75,
  showLabels = true,
  size = "md",
  className,
}) => {
  const isEvaluated = percentage !== null && percentage !== undefined;
  const clampedValue = isEvaluated ? Math.min(100, Math.max(0, percentage)) : 0;
  const isMeetingTarget = isEvaluated && percentage >= target;

  const barColor = !isEvaluated
    ? "bg-slate-300"
    : isMeetingTarget
    ? "bg-emerald-500"
    : percentage >= target - 5
    ? "bg-amber-500"
    : "bg-rose-500";

  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  return (
    <div className={twMerge("w-full space-y-1.5", className)}>
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">
            {isEvaluated ? `${percentage.toFixed(1)}%` : "— (No conducted classes)"}
          </span>
          <span className="text-slate-500">Target: {target}%</span>
        </div>
      )}
      <div className={twMerge("relative w-full bg-slate-100 rounded-full overflow-hidden", heights[size])}>
        {/* Progress fill */}
        <div
          className={twMerge("h-full transition-all duration-300 rounded-full", barColor)}
          style={{ width: `${clampedValue}%` }}
        />
        {/* Target tick line */}
        {target > 0 && target < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900/30 z-10"
            style={{ left: `${target}%` }}
            title={`Target: ${target}%`}
          />
        )}
      </div>
    </div>
  );
};
