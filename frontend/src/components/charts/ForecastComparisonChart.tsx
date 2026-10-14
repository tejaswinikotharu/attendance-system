import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { SubjectForecast } from "../../types";

interface ForecastComparisonChartProps {
  subjects: SubjectForecast[];
  targetPercent?: number;
}

export const ForecastComparisonChart: React.FC<ForecastComparisonChartProps> = ({
  subjects,
  targetPercent = 75,
}) => {
  if (subjects.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-sm font-medium text-slate-600">
          No subjects available for forecasting
        </p>
      </div>
    );
  }

  const data = subjects.map((sub) => ({
    name: sub.subjectCode,
    current: sub.currentMetrics.currentPercentage ?? 0,
    attendAll: sub.scenarios.attendAllRemaining.projectedPercentage ?? 0,
    missAll: sub.scenarios.missAllRemaining.projectedPercentage ?? 0,
    maintainRate: sub.scenarios.maintainCurrentRate.projectedPercentage ?? 0,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(value: any, name: any) => {
              const labels: Record<string, string> = {
                current: "Current",
                attendAll: "Attend All Remaining",
                missAll: "Miss All Remaining",
                maintainRate: "Maintain Rate",
              };
              return [`${Number(value).toFixed(1)}%`, labels[name] || name];
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => {
              const labels: Record<string, string> = {
                current: "Current",
                attendAll: "Attend All",
                missAll: "Miss All",
                maintainRate: "Maintain Rate",
              };
              return <span className="text-xs text-slate-600">{labels[value] || value}</span>;
            }}
          />
          <ReferenceLine
            y={targetPercent}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{
              value: `Target ${targetPercent}%`,
              position: "insideTopRight",
              fill: "#ef4444",
              fontSize: 10,
            }}
          />
          <Bar dataKey="current" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="attendAll" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="missAll" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="maintainRate" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
