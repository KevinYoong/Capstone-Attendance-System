import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { 
  ChevronLeft, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  AlertCircle 
} from "lucide-react";

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

/**
 * StudentClassAnalytics Component
 * * Features:
 * - Detailed view of attendance for a specific course.
 * - Progress visualization (Attendance Rate).
 * - Chronological session breakdown (Latest sessions displayed first).
 */
export default function StudentClassAnalytics() {
  const { class_id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------------------------------
  //                                DATA LOADING
  // --------------------------------------------------------------------------

  useEffect(() => {
    const loadData = async () => {
      if (!user || !class_id) return;
      try {
        setLoading(true);
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
    loadData();
  }, [user, class_id]);

  // --------------------------------------------------------------------------
  //                                LOGIC HELPERS
  // --------------------------------------------------------------------------

  /** * Memoized sorted sessions list.
   * Logic: Sorts by date in descending order (Newest first).
   */
  const sortedSessions = useMemo(() => {
    if (!data?.class?.sessions) return [];
    // Slice to create a shallow copy before sorting to avoid mutating state
    return [...data.class.sessions].sort((a, b) => {
      return new Date(b.date || b.started_at).getTime() - new Date(a.date || a.started_at).getTime();
    });
  }, [data]);

  if (loading) {
    return <div className="p-8 text-white text-center animate-pulse">Analyzing session data...</div>;
  }

  if (!data || !data.class) {
    return (
      <div className="p-8 text-white text-center">
        <p className="text-gray-400 mb-4">Class analytics data is currently unavailable.</p>
        <button onClick={() => navigate("/student/analytics")} className="text-blue-400 underline">Return to Overview</button>
      </div>
    );
  }

  const cls = data.class;
  const rate = cls.attendance_rate;
  const statusColor = rate >= 90 ? "text-green-400" : rate >= 80 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation & Header */}
        <button
          className="group flex items-center gap-2 mb-8 text-gray-400 hover:text-white transition"
          onClick={() => navigate("/student/analytics")}
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to Analytics
        </button>

        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest uppercase border border-blue-500/20">
              {cls.course_code}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">{cls.class_name}</h1>
        </header>

        {/* Attendance Score Card */}
        <div className="bg-[#181818]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-10 shadow-2xl overflow-hidden relative">
          {/* Subtle background decoration */}
          <TrendingUp className="absolute right-[-20px] bottom-[-20px] text-white/5" size={200} />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <p className="text-gray-500 uppercase tracking-widest font-bold text-xs mb-1">Current Attendance Rate</p>
              <h2 className={`text-6xl font-black ${statusColor}`}>{rate}%</h2>
              <p className={`mt-2 font-bold uppercase text-sm ${statusColor}`}>
                Status: {cls.attendance_status}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
              <StatCard label="Total" value={cls.total_sessions} />
              <StatCard label="Present" value={cls.present_count} color="text-green-400" />
              <StatCard label="Missed" value={cls.missed_count} color="text-red-400" />
            </div>
          </div>
        </div>

        {/* Session Breakdown List */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
             Session History
             <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded">Latest First</span>
          </h2>
        </div>

        <div className="space-y-3">
          {sortedSessions.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">No sessions have been recorded for this class yet.</div>
          ) : (
            sortedSessions.map((sess: any) => {
              // Status Logic: Supports both 'present' and 'checked-in' strings
              const isPresent = sess.status === "present" || sess.status === "checked-in";
              const isMissed = sess.status === "missed";

              return (
                <div
                  key={sess.session_id}
                  className="bg-[#1d1d2b]/60 border border-white/5 hover:border-white/20 rounded-2xl p-5 flex justify-between items-center transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPresent ? 'bg-green-500/10 text-green-400' : isMissed ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
                      {isPresent ? <CheckCircle size={24} /> : isMissed ? <XCircle size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-100 flex items-center gap-2">
                        <Calendar size={14} className="text-gray-500"/>
                        {new Date(sess.date || sess.started_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                        <Clock size={12}/>
                        {new Date(sess.date || sess.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter border ${
                      isPresent ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      isMissed ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    }`}>
                    {isPresent ? "Present" : isMissed ? "Absent" : "Pending"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
//                                SUB-COMPONENTS
// ============================================================================

function StatCard({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) {
  return (
    <div className="bg-black/30 border border-white/5 px-4 py-3 rounded-2xl text-center min-w-[90px]">
      <p className="text-[10px] text-gray-500 font-black uppercase tracking-tighter mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}