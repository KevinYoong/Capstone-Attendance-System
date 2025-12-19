import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, BarChart2, LogOut, AlertTriangle } from "lucide-react";

export default function StudentAnalyticsOverview() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // Ensure this matches the backend route exactly
        const res = await axios.get(`http://localhost:3001/student/${user.id}/analytics`);
        if (res.data.success) {
          setAnalytics(res.data);
        } else {
          setError("Failed to load analytics data.");
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
        setError("Analytics route not found or server error.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <div className="p-8 text-white text-center">Loading your progress...</div>;
  
  if (error || !analytics?.classes) {
    return (
      <div className="p-8 text-white text-center">
        <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
        <p>{error || "No enrollment data found for this semester."}</p>
        <button onClick={() => navigate("/student")} className="mt-4 text-blue-400 underline">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Attendance Analytics</h1>
          <p className="text-gray-400">{analytics.semester?.name}</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/student")} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/10">
            <ChevronLeft size={18} /> Dashboard
          </button>
          <button onClick={logout} className="p-2 bg-red-600/20 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Class Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {analytics.classes.map((cls: any) => {
          const rate = cls.attendance_rate;
          const statusColor = rate >= 90 ? "text-green-400" : rate >= 80 ? "text-yellow-400" : "text-red-400";

          return (
            <div
              key={cls.class_id}
              className="bg-[#181818]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-blue-500/50 transition-all group"
              onClick={() => navigate(`/student/analytics/class/${cls.class_id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold group-hover:text-blue-400 transition">{cls.class_name}</h2>
                  <p className="text-sm text-gray-500 font-mono uppercase">{cls.course_code}</p>
                </div>
                <div className={`text-2xl font-black ${statusColor}`}>{rate}%</div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <StatBox label="Total" value={cls.total_sessions} />
                <StatBox label="Present" value={cls.present_count} color="text-green-400" />
                <StatBox label="Missed" value={cls.missed_count} color="text-red-400" />
              </div>

              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
                <span>Status: <span className={statusColor}>{cls.attendance_status}</span></span>
                <span className="flex items-center gap-1 text-blue-400">View Details <BarChart2 size={14}/></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "text-white" }: any) {
  return (
    <div className="bg-black/20 rounded-lg p-2 text-center border border-white/5">
      <p className="text-[10px] text-gray-500 uppercase font-bold">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}