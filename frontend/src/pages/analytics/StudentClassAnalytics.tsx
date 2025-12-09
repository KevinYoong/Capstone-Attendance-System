import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

export default function StudentClassAnalytics() {
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

  if (loading) {
    return <div className="p-8 text-white text-center">Loading class analytics…</div>;
  }

  if (!data) {
    return <div className="p-8 text-white text-center">No analytics found.</div>;
  }

  const cls = data.class;

  const summary = {
    total_sessions: cls.total_sessions,
    present_count: cls.present_count,
    missed_count: cls.missed_count,
    attendance_rate: cls.attendance_rate,
    attendance_status: cls.attendance_status
  };

  const statusColor =
    summary.attendance_status === "good"
      ? "text-green-400"
      : summary.attendance_status === "warning"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-white p-8">
      <button
        className="mb-6 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
        onClick={() => navigate("/student/analytics")}
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-2">{cls.class_name}</h1>
      <p className="text-gray-300 mb-4">{cls.course_code}</p>

      {/* Summary Box */}
      <div className="bg-[#181818]/70 border border-white/10 rounded-xl p-6 mb-6">
        <p className="text-lg font-semibold">Attendance Summary</p>

        <p className="mt-2">Total Sessions: {summary.total_sessions}</p>
        <p className="text-green-400">Present: {summary.present_count}</p>
        <p className="text-red-400">Missed: {summary.missed_count}</p>

        <p className={`mt-2 text-xl font-bold ${statusColor}`}>
          {summary.attendance_rate}% — {summary.attendance_status.toUpperCase()}
        </p>
      </div>

      {/* Sessions List */}
      <h2 className="text-2xl font-semibold mb-3">Session Breakdown</h2>

      <div className="space-y-3">
        {cls.sessions.map((sess: any) => {
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