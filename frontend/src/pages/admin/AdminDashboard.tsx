import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white">
      <AdminSidebar />

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}