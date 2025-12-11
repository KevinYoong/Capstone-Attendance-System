import { useState } from "react";
import {
  CalendarDays,
  Users,
  GraduationCap,
  Layers,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  collapsed: boolean;
}

function SidebarItem({ icon, label, to, collapsed }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors 
         ${isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-white/10"}`
      }
    >
      <div className="text-xl">{icon}</div>
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </NavLink>
  );
}

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`h-screen bg-[#0d1b2a] border-r border-white/10 transition-all duration-300
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          {collapsed ? (
            <ChevronRight className="text-white" />
          ) : (
            <ChevronLeft className="text-white" />
          )}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex flex-col gap-1 mt-6 px-2">
        <SidebarItem
          icon={<CalendarDays />}
          label="Semesters"
          to="/admin/semesters"
          collapsed={collapsed}
        />
        <SidebarItem
          icon={<Users />}
          label="Students"
          to="/admin/students"
          collapsed={collapsed}
        />
        <SidebarItem
          icon={<GraduationCap />}
          label="Lecturers"
          to="/admin/lecturers"
          collapsed={collapsed}
        />
        <SidebarItem
          icon={<Layers />}
          label="Classes"
          to="/admin/classes"
          collapsed={collapsed}
        />
      </nav>
    </div>
  );
}