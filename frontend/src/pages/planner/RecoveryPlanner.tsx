import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { DeficitSubject } from "../../types";

interface RecoveryPlannerProps {
  semesterId: string;
}

export const RecoveryPlanner: React.FC<RecoveryPlannerProps> = ({ semesterId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["recoveryPlan", semesterId],
    queryFn: () => api.getRecoveryPlan(semesterId),
    enabled: !!semesterId,
  });

  if (isLoading) {
    return (
      <Card title="Deficit Recovery Planner">
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Computing recovery feasibility...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return null;
  }

  const deficitSubjects = data?.deficitSubjects || [];

  if (deficitSubjects.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            All Subjects Meet Attendance Target!
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            None of your registered courses are currently below target. Keep up the consistent attendance to maintain your safe bunk cushion.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Deficit Recovery Planner (${deficitSubjects.length} At-Risk Subjects)`}
      subtitle="Exact recovery classes required to regain institutional target eligibility"
    >
      <div className="space-y-4">
        {deficitSubjects.map((sub: DeficitSubject) => (
          <div
            key={sub.subjectId}
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              sub.isAchievable
                ? "bg-amber-50/50 border-amber-200"
                : "bg-rose-50/50 border-rose-200"
            }`}
          >
            {/* Subject details & status */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: sub.color }}
                />
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {sub.subjectName}
                </h4>
                <span className="text-xs font-mono text-slate-500 uppercase">
                  ({sub.subjectCode})
                </span>
                <Badge
                  variant={sub.isAchievable ? "WARNING" : "CRITICAL"}
                  size="sm"
                >
                  {sub.isAchievable ? "Feasible" : "Impossible"}
                </Badge>
              </div>

              <p className="text-xs font-semibold text-slate-800 mt-2 flex items-center gap-1.5">
                {sub.isAchievable ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                {sub.headline}
              </p>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {sub.actionPlan}
              </p>
            </div>

            {/* Recovery metrics stats pill */}
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shrink-0 text-xs">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase">
                  Current
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {sub.currentPercentage?.toFixed(1)}%
                </p>
                <span className="text-[10px] text-slate-400">
                  Target: {sub.targetPercent}%
                </span>
              </div>

              <div className="w-px h-8 bg-slate-100" />

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase">
                  Classes Needed
                </p>
                <p className="font-bold text-amber-600 mt-0.5">
                  {sub.recoveryClassesNeeded}
                </p>
                <span className="text-[10px] text-slate-400">
                  {sub.remainingSessions} remain
                </span>
              </div>

              {!sub.isAchievable && (
                <>
                  <div className="w-px h-8 bg-slate-100" />
                  <div>
                    <p className="text-[10px] font-semibold text-rose-600 uppercase">
                      Shortfall
                    </p>
                    <p className="font-bold text-rose-700 mt-0.5">
                      -{sub.shortfall}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Max: {sub.maxAchievablePercentage.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

        <p className="text-[11px] text-slate-400 flex items-start gap-1 pt-2 border-t border-slate-100">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {data?.disclaimer}
        </p>
      </div>
    </Card>
  );
};
