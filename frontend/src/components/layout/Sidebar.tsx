import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  History,
  Calculator,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSemester } from "../../context/SemesterContext";

interface SidebarProps {
  onNavClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavClick }) => {
  const { user, logout } = useAuth();
  const { selectedSemester, semesters, setSelectedSemesterId } = useSemester();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Timetable", href: "/timetable", icon: Calendar },
    { name: "Daily Attendance", href: "/attendance", icon: CheckSquare },
    { name: "Attendance History", href: "/history", icon: History },
    { name: "Smart Bunk Planner", href: "/planner", icon: Calculator },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-full shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
            AttendWise
          </h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">
            Bunk & Attendance
          </p>
        </div>
      </div>

      {/* Semester Selector Card */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <label
          htmlFor="semester-select"
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
        >
          Active Semester
        </label>
        {Array.isArray(semesters) && semesters.length > 0 ? (
          <select
            id="semester-select"
            value={selectedSemester?.id || ""}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-500 italic">No semester created</p>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {user?.fullName || "Student"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
