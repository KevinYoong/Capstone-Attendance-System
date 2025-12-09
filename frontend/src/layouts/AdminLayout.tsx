import AdminSidebar from "../components/AdminSidebar";
import { useAuth } from "../context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";

export default function AdminLayout() {
  const { user } = useAuth();

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex bg-[#0a0f1f] text-white min-h-screen">
      <AdminSidebar />

      <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923]">
        <Outlet />  
      </div>
    </div>
  );
}