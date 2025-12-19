import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import socket from '../utils/socket';
import axios from 'axios';
import { 
  LogOut, 
  BarChart2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronRight, 
  MapPin, 
  Calendar,
  AlertCircle
} from 'lucide-react';

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface Class {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_type: string;
  lecturer_name: string;
}

type WeekSchedule = {
  Monday: Class[];
  Tuesday: Class[];
  Wednesday: Class[];
  Thursday: Class[];
  Friday: Class[];
};

interface Semester {
  semester_id: number;
  name: string;
  start_date: string;
  end_date: string;
  current_week: number;
  is_sem_break: boolean;
  status: string;
}

// ============================================================================
//                                UTILITIES
// ============================================================================

function getCurrentAcademicWeek(startDateStr: string): number {
  const startDate = new Date(startDateStr);
  const today = new Date();
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(14, week));
}

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule>({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [],
  });
  const [semester, setSemester] = useState<Semester | null>(null);
  const [activeSessions, setActiveSessions] = useState<Record<number, any>>({});
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceSummaryByClass, setAttendanceSummaryByClass] = useState<Record<number, any>>({});

  // UI State
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [checkingInClassId, setCheckingInClassId] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [isViewingSemBreak, setIsViewingSemBreak] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // --- Navigation Handlers ---
  const handlePreviousWeek = () => {
    if (isViewingSemBreak) {
      setIsViewingSemBreak(false);
      setSelectedWeek(7);
    } else if (selectedWeek === 8) {
      setIsViewingSemBreak(true);
    } else if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (isViewingSemBreak) {
      setIsViewingSemBreak(false);
      setSelectedWeek(8);
    } else if (selectedWeek === 7) {
      setIsViewingSemBreak(true);
    } else if (selectedWeek < 14) {
      setSelectedWeek(selectedWeek + 1);
    }
  };

  const handleCurrentWeek = () => {
    if (semester) {
      setIsViewingSemBreak(false);
      setSelectedWeek(semester.current_week);
    }
  };

  // --------------------------------------------------------------------------
  //                                API ACTIONS
  // --------------------------------------------------------------------------

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const sessionRes = await axios.get(`http://localhost:3001/student/${user.id}/active-sessions`);
      if (sessionRes.data?.success) {
        const map: Record<number, any> = {};
        sessionRes.data.sessions.forEach((s: any) => {
          map[s.class_id] = {
            session_id: s.session_id,
            expiresAt: s.expires_at,
            onlineMode: !!s.online_mode,
            scheduled_date: s.scheduled_date, 
          };
        });
        setActiveSessions(map);
      }

      const attRes = await axios.get(`http://localhost:3001/student/${user.id}/attendance/semester`);
      if (attRes.data?.success) {
        setAttendanceSessions(attRes.data.attendance || []);
        const summaryMap: Record<number, any> = {};
        attRes.data.summary_by_class?.forEach((s: any) => {
          summaryMap[s.class_id] = s;
        });
        setAttendanceSummaryByClass(summaryMap);
      }
    } catch (err) {
      console.error("Error syncing dashboard data:", err);
    }
  }, [user?.id]);

  const fetchSchedule = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get<WeekSchedule>(
        `http://localhost:3001/student/${user.id}/classes/week?week=${isViewingSemBreak ? "break" : selectedWeek}`
      );
      setWeekSchedule({
        Monday: res.data.Monday || [],
        Tuesday: res.data.Tuesday || [],
        Wednesday: res.data.Wednesday || [],
        Thursday: res.data.Thursday || [],
        Friday: res.data.Friday || [],
      });
    } catch (err) {
      console.error("Error fetching schedule:", err);
    }
  }, [user?.id, selectedWeek, isViewingSemBreak]);

  // --------------------------------------------------------------------------
  //                                EFFECTS
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;
    socket.emit("joinStudentRooms", user.id);

    const initSemester = async () => {
      setLoading(true);
      try {
        const res = await axios.get('http://localhost:3001/semester/current');
        if (res.data.success) {
          const sem = res.data.data;
          const current = getCurrentAcademicWeek(sem.start_date);
          setSemester({ ...sem, current_week: current });
          setSelectedWeek(current);
        }
      } finally {
        setLoading(false);
      }
    };

    initSemester();
    fetchDashboardData();

    return () => { socket.emit("leaveStudentRooms", user.id); };
  }, [user, fetchDashboardData]);

  useEffect(() => {
    fetchSchedule();
  }, [selectedWeek, isViewingSemBreak, fetchSchedule]);

  /** * NEW: Auto-open logic 
   * When the schedule is loaded, find today's day name and add it to openDays.
   */
  useEffect(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    // Check if the current viewed week is actually the real current week
    const isActuallyCurrentWeek = semester && selectedWeek === semester.current_week && !isViewingSemBreak;
    
    if (isActuallyCurrentWeek && Object.keys(weekSchedule).includes(todayName)) {
      setOpenDays([todayName]);
    }
  }, [weekSchedule, semester, selectedWeek, isViewingSemBreak]);

  useEffect(() => {
    socket.on("checkinActivated", fetchDashboardData);
    socket.on("sessionExpired", fetchDashboardData);
    return () => {
      socket.off("checkinActivated");
      socket.off("sessionExpired");
    };
  }, [fetchDashboardData]);

  // --------------------------------------------------------------------------
  //                                HELPERS
  // --------------------------------------------------------------------------

  const getDateObjForDay = (dayName: string): Date | null => {
    if (!semester) return null;
    const dayIndex = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[dayName] ?? 0;
    const date = new Date(semester.start_date);
    date.setDate(date.getDate() + (selectedWeek - 1) * 7 + dayIndex);
    return date;
  };

  const handleCheckIn = async (classId: number) => {
    if (!user || checkingInClassId !== null) return;
    const session = activeSessions[classId];
    setCheckingInClassId(classId);

    if (!navigator.geolocation) {
      alert("Location services not supported");
      setCheckingInClassId(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await axios.post('http://localhost:3001/student/checkin', {
          student_id: user.id,
          session_id: session.session_id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
        if (res.data.success) {
          alert("Check-in successful!");
          fetchDashboardData();
        }
      } catch (err: any) {
        alert(err.response?.data?.message || "Check-in failed");
      } finally {
        setCheckingInClassId(null);
      }
    }, () => {
      alert("Please enable location access.");
      setCheckingInClassId(null);
    }, { enableHighAccuracy: true });
  };

  // --------------------------------------------------------------------------
  //                                RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Student Dashboard</h1>
            <p className="text-gray-400 mt-1 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               Logged in as {user?.name}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={() => navigate("/student/analytics")} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition font-bold shadow-lg shadow-blue-600/20">
              <BarChart2 size={18} /> Analytics
            </button>
            <button onClick={logout} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition font-bold border border-red-600/20">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        {/* Semester Banner */}
        {!loading && semester && (
          <div className="bg-[#1a1a2e]/60 backdrop-blur-xl p-6 rounded-3xl border border-blue-500/20 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-black text-blue-400">{semester.name}</h2>
              <div className="mt-1">
                {isViewingSemBreak ? 
                  <span className="text-orange-400 font-bold bg-orange-400/10 px-3 py-1 rounded-full text-xs uppercase tracking-wider">🏖️ Semester Break</span> :
                  <p className="text-gray-300 font-medium">Viewing Week <span className="text-white font-black">{selectedWeek}</span></p>
                }
              </div>
            </div>

            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
              <button onClick={handlePreviousWeek} disabled={!isViewingSemBreak && selectedWeek <= 1} className="p-2 hover:bg-white/10 rounded-xl transition disabled:opacity-20"><ChevronRight size={20} className="rotate-180"/></button>
              
              <button 
                onClick={handleCurrentWeek} 
                className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition tracking-widest ${
                  selectedWeek === semester.current_week && !isViewingSemBreak 
                  ? 'bg-blue-600 text-white' 
                  : 'text-blue-400 hover:bg-white/5'
                }`}
              >
                {selectedWeek === semester.current_week && !isViewingSemBreak ? 'Current' : `Go to Week ${semester.current_week}`}
              </button>

              <button onClick={handleNextWeek} disabled={!isViewingSemBreak && selectedWeek >= 14} className="p-2 hover:bg-white/10 rounded-xl transition disabled:opacity-20"><ChevronRight size={20}/></button>
            </div>
          </div>
        )}

        {/* Schedule */}
        <div className="grid gap-4">
          {Object.entries(weekSchedule).map(([day, classes]) => {
            const isOpen = openDays.includes(day);
            const dateStr = getDateObjForDay(day)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return (
              <div key={day} className="group overflow-hidden rounded-3xl border border-white/10 transition-all duration-300 hover:border-white/20">
                <button 
                  onClick={() => setOpenDays(isOpen ? openDays.filter(d => d !== day) : [...openDays, day])}
                  className={`w-full flex items-center justify-between px-6 py-4 transition-colors ${isOpen ? 'bg-white/5' : 'bg-[#181818]/40'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-lg font-bold ${isOpen ? 'text-white' : 'text-gray-400'}`}>{day}</span>
                    <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-lg uppercase tracking-tighter">{dateStr}</span>
                  </div>
                  <ChevronRight size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-blue-400' : 'text-gray-600'}`}/>
                </button>

                <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} bg-black/20`}>
                  <div className="p-4 space-y-3">
                    {classes.length === 0 ? <p className="text-center py-6 text-gray-600 italic text-sm">No classes scheduled.</p> : 
                      classes.map(cls => {
                        const rowIso = getDateObjForDay(day)?.toLocaleDateString('en-CA');
                        const history = attendanceSessions.find(s => s.class_id === cls.class_id && (s.scheduled_date === rowIso || new Date(s.started_at).toLocaleDateString('en-CA') === rowIso));
                        
                        const isCheckedIn = history?.student_status === "present" || history?.student_status === "checked-in";
                        const isMissed = history?.student_status === "missed";
                        const active = activeSessions[cls.class_id];
                        const isActiveNow = active && active.scheduled_date === rowIso && !isCheckedIn && !isMissed;
                        const isProcessing = checkingInClassId === cls.class_id;

                        return (
                          <div 
                            key={cls.class_id} 
                            className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 rounded-2xl border transition-all duration-300 
                              ${isActiveNow ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]' : 
                                isMissed ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 
                                'bg-white/5 border-white/5 hover:bg-white/10'}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-bold text-lg ${isMissed ? 'text-red-400' : 'text-gray-100'}`}>{cls.class_name}</h3>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">{cls.course_code}</span>
                                {attendanceSummaryByClass[cls.class_id] && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${attendanceSummaryByClass[cls.class_id].attendance_status === 'good' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {attendanceSummaryByClass[cls.class_id].attendance_rate}% ATT
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-xs flex items-center gap-1.5"><Calendar size={12}/> {cls.lecturer_name} • {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)} ({cls.class_type})</p>
                              
                              <div className="mt-3">
                                {isCheckedIn ? <span className="text-xs font-bold uppercase text-green-400 flex items-center gap-1.5 bg-green-400/10 w-fit px-3 py-1 rounded-full border border-green-400/20"><CheckCircle size={14}/> Completed</span> :
                                 isMissed ? <span className="text-xs font-bold uppercase text-red-500 flex items-center gap-1.5 bg-red-500/20 w-fit px-3 py-1 rounded-full border border-red-500/40"><XCircle size={14}/> Absent</span> :
                                 isActiveNow ? <span className="text-xs font-bold uppercase text-yellow-400 flex items-center gap-1.5 bg-yellow-400/20 w-fit px-3 py-1 rounded-full border border-yellow-400/40 animate-pulse"><MapPin size={14}/> Active Session</span> :
                                 <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1.5 bg-white/5 w-fit px-3 py-1 rounded-full border border-white/5"><Clock size={14}/> Upcoming</span>}
                              </div>
                            </div>

                            <button 
                              onClick={() => handleCheckIn(cls.class_id)}
                              disabled={!isActiveNow || isProcessing || checkingInClassId !== null}
                              className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-lg ${
                                isActiveNow ? "bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/50 scale-105" : 
                                isCheckedIn ? "bg-green-900/20 text-green-700 cursor-not-allowed border border-green-900/10" :
                                isMissed ? "bg-red-900/30 text-red-500 cursor-not-allowed border border-red-800/50 opacity-100" :
                                "bg-white/5 text-gray-600 cursor-not-allowed border border-white/5"
                              }`}
                            >
                              {isActiveNow ? (isProcessing ? "Verifying..." : "Check In Now") : isCheckedIn ? "Completed" : isMissed ? "Absent" : "Unavailable"}
                            </button>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-2 text-gray-600 text-[10px] uppercase tracking-[0.3em] font-black">
           <AlertCircle size={14}/> <span>Verified Geolocation Required</span>
        </div>
      </div>
    </div>
  );
}