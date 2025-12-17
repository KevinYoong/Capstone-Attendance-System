import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

export default function LecturerClassAnalytics() {
  const { class_id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="text-white p-8 text-center">Loading class analytics…</div>;
  }

  if (!data) {
    return <div className="text-white p-8 text-center">No analytics found.</div>;
  }

  const summary = data.summary;
  const students = data.students;
  const sessions = data.sessions;

  // Assign a numeric score to each status (Lower number = Higher Priority)
  const getStatusPriority = (status: string) => {
    switch (status) {
      case "critical": return 1; // Highest priority
      case "warning": return 2;  // Medium priority
      case "good": return 3;     // Lowest priority
      default: return 4;         // Fallback
    }
  };

  const sortedStudents = [...data.students].sort((a: any, b: any) => {
    const priorityA = getStatusPriority(a.attendance_status);
    const priorityB = getStatusPriority(b.attendance_status);

    // Primary Sort: Compare Status Priority
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Secondary Sort: Alphabetical by Name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen text-white bg-[#0a0f1f] p-8">
      <button
        onClick={() => navigate("/lecturer/analytics")}
        className="mb-6 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-4">Class Analytics</h1>

      {/* SUMMARY */}
      <div className="bg-[#181818]/70 border border-white/10 p-6 rounded-xl mb-6">
        <h2 className="text-xl font-semibold mb-2">Attendance Summary</h2>

        <p>Total Sessions: {summary.total_sessions}</p>
        <p className="text-green-400">Present Total: {summary.present_total}</p>
        <p className="text-red-400">Missed Total: {summary.missed_total}</p>
      </div>

      {/* CSV Export */}
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

      {/* SESSION BREAKDOWN */}
      <h2 className="text-2xl font-semibold mb-3">Session Breakdown</h2>
      <div className="space-y-3 mb-6">
        {sessions.map((s: any) => (
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

      {/* STUDENT BREAKDOWN */}
      <h2 className="text-2xl font-semibold mb-3">Student Attendance</h2>

      <div className="space-y-4">
        {sortedStudents.map((st: any) => {
          // Determine text color based on status
          const color =
            st.attendance_status === "good"
              ? "text-green-400"
              : st.attendance_status === "warning"
              ? "text-yellow-400"
              : "text-red-400";

          // Determine border color highlights
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
                
                {/* Status Badges */}
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