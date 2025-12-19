import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

// ==========================================
// Types & Interfaces
// ==========================================

interface ClassAnalytics {
  class_id: number;
  class_name: string;
  course_code: string;
  total_sessions: number;
  present_count: number;
  missed_count: number;
  attendance_status: "good" | "warning" | "critical";
}

interface AnalyticsResponse {
  classes: ClassAnalytics[];
}

// ==========================================
// Component: StudentAnalyticsOverview
// ==========================================

export default function StudentAnalyticsOverview() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  // ------------------------------------------
  // Data Fetching
  // ------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch analytics for the logged-in student
        const res = await axios.get(`http://localhost:3001/student/${user.id}/analytics`);
        setAnalytics(res.data);
      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ------------------------------------------
  // Render States
  // ------------------------------------------

  if (loading) {
    return (
      <div className="p-8 text-white text-center">
        Loading analytics...
      </div>
    );
  }

  if (!analytics || !analytics.classes) {
    return (
      <div className="p-8 text-white text-center">
        No analytics found.
      </div>
    );
  }

  // ------------------------------------------
  // Main Render
  // ------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-white p-8">
      
      {/* --- Header Section --- */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Attendance Analytics</h1>

        <div className="flex items-center gap-4">
          {/* Back to Dashboard */}
          <button
            onClick={() => navigate("/student")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
          >
            ← Back to Dashboard
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* --- Analytics Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analytics.classes.map((cls) => {
          // Determine text color based on status
          const statusColor =
            cls.attendance_status === "good"
              ? "text-green-400"
              : cls.attendance_status === "warning"
              ? "text-yellow-400"
              : "text-red-400";

          return (
            <div
              key={cls.class_id}
              className="bg-[#181818]/70 border border-white/10 rounded-xl p-6 cursor-pointer hover:bg-[#222222]"
              onClick={() =>
                navigate(`/student/analytics/class/${cls.class_id}`)
              }
            >
              <h2 className="text-xl font-semibold">
                {cls.class_name} ({cls.course_code})
              </h2>

              <p className="text-gray-300 mt-2">
                Sessions: {cls.total_sessions}
              </p>
              <p className="text-green-400">Present: {cls.present_count}</p>
              <p className="text-red-400">Missed: {cls.missed_count}</p>

              <p className={`mt-2 font-semibold ${statusColor}`}>
                Status: {cls.attendance_status.toUpperCase()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}