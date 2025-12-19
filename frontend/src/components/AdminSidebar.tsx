import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  CalendarDays,
  Users,
  GraduationCap,
  Layers,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  collapsed: boolean;
}

// ============================================================================
//                                HELPER COMPONENTS
// ============================================================================

/**
 * SidebarItem
 * Renders a single navigation link.
 * * Highlights automatically when the route is active.
 * * Hides the label when the sidebar is collapsed.
 */
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

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

/**
 * AdminSidebar
 * The main navigation drawer for the Admin Dashboard.
 * * Features:
 * - Collapsible state (Expand/Shrink).
 * - Navigation links to Semesters, Students, Lecturers, Classes.
 * - Logout functionality at the bottom.
 */
export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside
      className={`h-full bg-[#181818] border-r border-white/10 flex flex-col flex-shrink-0 transition-all duration-300 ${
        collapsed ? "w-20" : "w-56"
      }`}
    >
      {/* Header / Logo Area */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        {!collapsed && (
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Admin
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-1 mt-6 px-2 flex-1">
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

      {/* Footer / Logout Section */}
      <div className="p-2 border-t border-white/10 mb-2 mx-2">
        <button
          onClick={handleLogout}
          // Note: Kept flex alignment consistent with SidebarItems
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
            text-red-400 hover:bg-red-500/10 hover:text-red-300`}
          title="Logout"
        >
          <div className="text-xl">
            <LogOut />
          </div>
          
          {!collapsed && <span className="text-sm font-medium">Log Out</span>}
        </button>
      </div>
    </aside>
  );
}