import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LecturerAnalyticsOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3001/lecturer/${user.id}/analytics`
        );
        setAnalytics(res.data);
      } catch (err) {
        console.error("Error loading lecturer analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  if (loading) {
    return <div className="text-white p-8 text-center">Loading analytics...</div>;
  }

  if (!analytics || !analytics.classes) {
    return <div className="text-white p-8 text-center">No analytics found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-white p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Attendance Analytics</h1>

        <div className="flex items-center gap-4">
          {/* Back to Dashboard */}
          <button
            onClick={() => navigate("/lecturer")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
          >
            ← Back to Dashboard
          </button>

          {/* Logout button */}
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analytics.classes.map((cls: any) => {
          const statusColor =
            cls.attendance_status === "good"
              ? "text-green-400"
              : cls.attendance_status === "warning"
              ? "text-yellow-400"
              : "text-red-400";

          return (
            <div
              key={cls.class_id}
              className="bg-[#1b1b2c]/70 border border-white/10 rounded-xl p-6 hover:bg-[#252538] cursor-pointer transition"
              onClick={() =>
                navigate(`/lecturer/analytics/class/${cls.class_id}`)
              }
            >
              <h2 className="text-xl font-semibold">
                {cls.class_name} ({cls.course_code})
              </h2>

              <p className="text-gray-300 mt-2">
                Total Sessions: {cls.total_sessions}
              </p>
              <p className="text-green-400">
                Total Present: {cls.present_count}
              </p>
              <p className="text-red-400">Total Missed: {cls.missed_count}</p>

              <p className={`mt-3 font-bold ${statusColor}`}>
                {cls.attendance_rate}% — {cls.attendance_status.toUpperCase()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}