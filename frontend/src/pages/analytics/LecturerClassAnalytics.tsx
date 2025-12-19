import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

// ==========================================
// Types & Interfaces
// ==========================================

interface Summary {
  total_sessions: number;
  present_total: number;
  missed_total: number;
}

interface Session {
  session_id: number;
  date: string;
  attendance_rate: number;
  present_count: number;
  missed_count: number;
}

interface Student {
  student_id: number;
  name: string;
  email: string;
  attendance_status: "good" | "warning" | "critical";
  present_count: number;
  missed_count: number;
  attendance_rate: number;
}

interface ClassAnalyticsData {
  summary: Summary;
  students: Student[];
  sessions: Session[];
}

// ==========================================
// Component: LecturerClassAnalytics
// ==========================================

export default function LecturerClassAnalytics() {
  const { class_id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [data, setData] = useState<ClassAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // ------------------------------------------
  // Data Fetching
  // ------------------------------------------
  useEffect(() => {
    const load = async () => {
      if (!user || !class_id) return;

      try {
        const res = await axios.get(
          `http://localhost:3001/lecturer/${user.id}/analytics/class/${class_id}`
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
  // Helper Logic
  // ------------------------------------------

  // Helper: Assign a numeric priority to status for sorting
  const getStatusPriority = (status: string) => {
    switch (status) {
      case "critical": return 1; // Highest priority
      case "warning": return 2;  // Medium priority
      case "good": return 3;     // Lowest priority
      default: return 4;         // Fallback
    }
  };

  if (loading) {
    return <div className="text-white p-8 text-center">Loading class analytics...</div>;
  }

  if (!data) {
    return <div className="text-white p-8 text-center">No analytics found.</div>;
  }

  const { summary, students, sessions } = data;

  // 1. Sort Students: Critical -> Warning -> Good, then Alphabetical
  const sortedStudents = [...students].sort((a, b) => {
    const priorityA = getStatusPriority(a.attendance_status);
    const priorityB = getStatusPriority(b.attendance_status);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.name.localeCompare(b.name);
  });

  // 2. Sort Sessions: Latest Date First (Descending)
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // ------------------------------------------
  // Main Render
  // ------------------------------------------

  return (
    <div className="min-h-screen text-white bg-[#0a0f1f] p-8">
      
      {/* Back Button */}
      <button
        onClick={() => navigate("/lecturer/analytics")}
        className="mb-6 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-4">Class Analytics</h1>

      {/* --- Section 1: Summary Stats --- */}
      <div className="bg-[#181818]/70 border border-white/10 p-6 rounded-xl mb-6">
        <h2 className="text-xl font-semibold mb-2">Attendance Summary</h2>
        <p>Total Sessions: {summary.total_sessions}</p>
        <p className="text-green-400">Present Total: {summary.present_total}</p>
        <p className="text-red-400">Missed Total: {summary.missed_total}</p>
      </div>

      {/* --- Section 2: CSV Exports --- */}
      <div className="mb-6">
        <a
          href={`http://localhost:3001/lecturer/${user?.id}/analytics/class/${class_id}/export.csv?type=students`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
        >
          Export Student CSV
        </a>

        <a
          href={`http://localhost:3001/lecturer/${user?.id}/analytics/class/${class_id}/export.csv?type=sessions`}
          className="ml-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
        >
          Export Session CSV
        </a>
      </div>

      {/* --- Section 3: Session Breakdown (Sorted Latest First) --- */}
      <h2 className="text-2xl font-semibold mb-3">Session Breakdown</h2>
      <div className="space-y-3 mb-6">
        {sortedSessions.map((s) => (
          <div
            key={s.session_id}
            className="bg-[#1d1d2b] p-4 border border-white/10 rounded-xl"
          >
            <p className="font-semibold">
              {new Date(s.date).toLocaleDateString()}
            </p>
            <p className="text-gray-300 text-sm">
              Attendance Rate: {s.attendance_rate}%
            </p>
            <p className="text-green-400">Present: {s.present_count}</p>
            <p className="text-red-400">Missed: {s.missed_count}</p>
          </div>
        ))}
      </div>

      {/* --- Section 4: Student List --- */}
      <h2 className="text-2xl font-semibold mb-3">Student Attendance</h2>

      <div className="space-y-4">
        {sortedStudents.map((st) => {
          const color =
            st.attendance_status === "good"
              ? "text-green-400"
              : st.attendance_status === "warning"
              ? "text-yellow-400"
              : "text-red-400";

          const borderClass = 
            st.attendance_status === "critical" ? "border-red-500/50" :
            st.attendance_status === "warning" ? "border-yellow-500/50" :
            "border-white/10";

          return (
            <div
              key={st.student_id}
              className={`bg-[#1d1d2b] border ${borderClass} p-4 rounded-xl`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{st.name}</p>
                  <p className="text-gray-300 text-sm">{st.email}</p>
                </div>
                
                {st.attendance_status === "critical" && (
                  <span className="bg-red-900/50 text-red-200 text-xs px-2 py-1 rounded border border-red-500/30">
                    CRITICAL
                  </span>
                )}
                {st.attendance_status === "warning" && (
                  <span className="bg-yellow-900/50 text-yellow-200 text-xs px-2 py-1 rounded border border-yellow-500/30">
                    WARNING
                  </span>
                )}
              </div>

              <div className="mt-2 flex gap-4 text-sm">
                <p>Present: {st.present_count}</p>
                <p>Missed: {st.missed_count}</p>
              </div>

              <p className={`font-bold mt-1 ${color}`}>
                {st.attendance_rate}% — {st.attendance_status.toUpperCase()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}