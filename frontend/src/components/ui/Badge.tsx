import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "SAFE"
    | "WARNING"
    | "CRITICAL"
    | "NO_DATA"
    | "ATTENDED"
    | "ABSENT"
    | "PENDING"
    | "CANCELLED"
    | "neutral"
    | "brand";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "md",
  children,
  className,
  ...props
}) => {
  const styles: Record<string, string> = {
    SAFE: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    WARNING: "bg-amber-50 text-amber-700 border-amber-200/80",
    CRITICAL: "bg-rose-50 text-rose-700 border-rose-200/80",
    NO_DATA: "bg-slate-100 text-slate-600 border-slate-200",
    ATTENDED: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    ABSENT: "bg-rose-50 text-rose-700 border-rose-200/80",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200/80",
    CANCELLED: "bg-slate-100 text-slate-500 border-slate-200 line-through decoration-slate-400",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    brand: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px] font-semibold",
    md: "px-2.5 py-1 text-xs font-medium",
  };

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center rounded-full border tracking-wide uppercase font-semibold",
          styles[variant] || styles.neutral,
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
};
