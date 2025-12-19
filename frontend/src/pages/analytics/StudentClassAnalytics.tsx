import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

// ==========================================
// Types & Interfaces
// ==========================================

interface Session {
  session_id: number;
  started_at: string;
  status: string;
}

interface ClassAnalyticsData {
  class_name: string;
  course_code: string;
  total_sessions: number;
  present_count: number;
  missed_count: number;
  attendance_rate: number;
  attendance_status: "good" | "warning" | "critical";
  sessions: Session[];
}

interface ApiResponse {
  class: ClassAnalyticsData;
}

// ==========================================
// Component: StudentClassAnalytics
// ==========================================

export default function StudentClassAnalytics() {
  const { class_id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // ------------------------------------------
  // Data Fetching
  // ------------------------------------------
  useEffect(() => {
    const load = async () => {
      if (!user || !class_id) return;

      try {
        const res = await axios.get(
          `http://localhost:3001/student/${user.id}/analytics/class/${class_id}`
        );
        setData(res.data);
      } catch (err) {
        console.error("Error loading class analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, class_id]);

  // ------------------------------------------
  // Render States
  // ------------------------------------------

  if (loading) {
    return <div className="p-8 text-white text-center">Loading class analytics…</div>;
  }

  if (!data) {
    return <div className="p-8 text-white text-center">No analytics found.</div>;
  }

  const cls = data.class;

  // ------------------------------------------
  // Helper Logic
  // ------------------------------------------

  // Sort sessions: Latest date first (Descending)
  const sortedSessions = [...cls.sessions].sort((a, b) => 
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  // Determine status color for the Summary Box
  const statusColor =
    cls.attendance_status === "good"
      ? "text-green-400"
      : cls.attendance_status === "warning"
      ? "text-yellow-400"
      : "text-red-400";

  // ------------------------------------------
  // Main Render
  // ------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-white p-8">
      {/* Back Button */}
      <button
        className="mb-6 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
        onClick={() => navigate("/student/analytics")}
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-2">{cls.class_name}</h1>
      <p className="text-gray-300 mb-4">{cls.course_code}</p>

      {/* --- Summary Box --- */}
      <div className="bg-[#181818]/70 border border-white/10 rounded-xl p-6 mb-6">
        <p className="text-lg font-semibold">Attendance Summary</p>

        <p className="mt-2">Total Sessions: {cls.total_sessions}</p>
        <p className="text-green-400">Present: {cls.present_count}</p>
        <p className="text-red-400">Missed: {cls.missed_count}</p>

        <p className={`mt-2 text-xl font-bold ${statusColor}`}>
          {cls.attendance_rate}% — {cls.attendance_status.toUpperCase()}
        </p>
      </div>

      {/* --- Sessions List (Sorted Latest First) --- */}
      <h2 className="text-2xl font-semibold mb-3">Session Breakdown</h2>

      <div className="space-y-3">
        {sortedSessions.map((sess) => {
          const isPresent = sess.status === "present";

          return (
            <div
              key={sess.session_id}
              className="bg-[#1d1d2b] border border-white/10 rounded-xl p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">
                  {new Date(sess.started_at).toLocaleDateString()}
                </p>
                <p className="text-gray-300 text-sm">
                  {new Date(sess.started_at).toLocaleTimeString()}
                </p>
              </div>

              <div
                className={`text-lg font-bold ${
                  isPresent ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPresent ? "Present" : "Missed"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}