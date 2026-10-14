import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { SubjectSummary } from "../../types";

interface AttendanceBarChartProps {
  subjects: SubjectSummary[];
  targetPercent?: number;
}

export const AttendanceBarChart: React.FC<AttendanceBarChartProps> = ({
  subjects,
  targetPercent = 75,
}) => {
  // Only graph subjects with conducted classes so we don't display fabricated/misleading data
  const evaluatedSubjects = subjects.filter((s) => s.conductedSessions > 0);

  if (evaluatedSubjects.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-sm font-medium text-slate-600">
          No attendance data to display yet
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Charts update automatically as classes are conducted and attendance is recorded.
        </p>
      </div>
    );
  }

  const data = evaluatedSubjects.map((s) => ({
    name: s.subjectCode || s.subjectName,
    fullName: s.subjectName,
    percentage: s.currentPercentage ?? 0,
    target: s.targetPercent,
    conducted: s.conductedSessions,
    attended: s.attendedSessions,
    color: s.color,
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
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
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200 text-xs">
                    <p className="font-semibold text-slate-900">{item.fullName}</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-indigo-600 font-medium">
                        Attendance: {item.percentage}% ({item.attended}/{item.conducted})
                      </p>
                      <p className="text-slate-500">Target: {item.target}%</p>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine
            y={targetPercent}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{
              value: `Target (${targetPercent}%)`,
              position: "insideTopRight",
              fill: "#ef4444",
              fontSize: 10,
            }}
          />
          <Bar
            dataKey="percentage"
            radius={[4, 4, 0, 0]}
            fill="#4f46e5"
            maxBarSize={45}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
