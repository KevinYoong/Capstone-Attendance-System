import { Navigate, Outlet } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { useAuth } from "../context/AuthContext";

/**
 * AdminLayout
 * * Wrapper for all Admin Dashboard pages.
 * * Enforces Role-Based Access Control (RBAC): Only 'admin' role allowed.
 * * Provides the Sidebar and main content area structure.
 */
export default function AdminLayout() {
  const { user } = useAuth();

  // 1. Security Check
  // If no user is logged in OR the user is not an admin, kick them out.
  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  // 2. Render Admin Interface
  return (
    <div className="flex bg-[#0a0f1f] text-white h-screen font-sans overflow-hidden">
      {/* Left Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Content Area */}
      {/* The gradient background gives a subtle professional feel to the dashboard */}
      <main className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923]">
        {/* Render the child route (e.g., Semesters, Students, etc.) */}
        <Outlet />  
      </main>
    </div>
  );
}