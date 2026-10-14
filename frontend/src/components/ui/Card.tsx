import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          "bg-white rounded-xl border border-slate-200/80 shadow-sm transition-shadow overflow-hidden",
          className
        )
      )}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
