import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import socket from '../utils/socket';
import axios from 'axios';

interface Class {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_type: string;
  lecturer_name: string;
  status?: 'grey' | 'yellow' | 'green' | 'red';
}

type Week = {
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

// Compute academic week based on semester start date and today's date
function getCurrentAcademicWeek(startDateStr: string): number {
  const startDate = new Date(startDateStr);
  const today = new Date();

  // Normalize times to midnight
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Week 1 = days 0–6 → week = 1 + (days / 7)
  const week = Math.floor(diffDays / 7) + 1;

  // Clamp range 1–14
  return Math.max(1, Math.min(14, week));
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [weekSchedule, setWeekSchedule] = useState<Week>({
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
  });
  const [openDays, setOpenDays] = useState<string[]>([]);

  const [activeSessions, setActiveSessions] = useState<Record<number, {
    session_id: number;
    startedAt: string;
    expiresAt: string;
    onlineMode: boolean;
    scheduled_date: string;
  }>>({});

  // Semester and week navigation state
  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loadingSemester, setLoadingSemester] = useState<boolean>(true);
  const [isViewingSemBreak, setIsViewingSemBreak] = useState<boolean>(false);

  // Store full semester attendance history
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceSummaryByClass, setAttendanceSummaryByClass] = useState<Record<number, any>>({});

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const fetchSchedule = useCallback(async (week?: number) => {
    try {
      const weekParam = week || selectedWeek;
      const res = await axios.get<Week>(
        `http://localhost:3001/student/${user?.id}/classes/week?week=${
          isViewingSemBreak ? "break" : weekParam
        }`
      );

      const schedule: Week = {
        Monday: Array.isArray(res.data.Monday) ? res.data.Monday : [],
        Tuesday: Array.isArray(res.data.Tuesday) ? res.data.Tuesday : [],
        Wednesday: Array.isArray(res.data.Wednesday) ? res.data.Wednesday : [],
        Thursday: Array.isArray(res.data.Thursday) ? res.data.Thursday : [],
        Friday: Array.isArray(res.data.Friday) ? res.data.Friday : [],
      };

      setWeekSchedule(schedule);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      setWeekSchedule({
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
      });
    }
  }, [user?.id, selectedWeek, isViewingSemBreak]);

  // Fetch active sessions for the logged-in student
  const fetchActiveSessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get<{ success: boolean; sessions: Array<any> }>(
        `http://localhost:3001/student/${user.id}/active-sessions`
      );

      if (!res.data?.success) return;

      const map: Record<number, any> = {};
      res.data.sessions.forEach((s: any) => {
        map[s.class_id] = {
          session_id: s.session_id,
          startedAt: new Date(s.started_at).toISOString(),
          expiresAt: new Date(s.expires_at).toISOString(),
          onlineMode: !!s.online_mode,
          scheduled_date: s.scheduled_date, // Ensure backend sends this, or derive it
        };
      });

      if (Object.keys(map).length > 0) {
        setActiveSessions((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error("Error fetching active sessions:", err);
    }
  }, [user?.id]);

  const fetchAttendanceSemester = useCallback(async () => {
    if (!user?.id || !semester) return;

    try {
      const res = await axios.get(
        `http://localhost:3001/student/${user.id}/attendance/semester`
      );

      if (!res.data?.success) return;

      const attendance = res.data.attendance || [];
      const summary = res.data.summary_by_class || [];

      setAttendanceSessions(attendance);

      const map: Record<number, any> = {};
      summary.forEach((s: any) => {
        map[s.class_id] = s;
      });
      setAttendanceSummaryByClass(map);

    } catch (err) {
      console.error("Error fetching attendance semester:", err);
    }
  }, [user?.id, semester]);

  // ---------------------------------------------------------
  // 1. Initial Load: Socket + Semester + Active Sessions
  // ---------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    console.log("🔌 Joining student rooms for:", user.id);
    socket.emit("joinStudentRooms", user.id);

    const fetchSemester = async () => {
      try {
        setLoadingSemester(true);
        const res = await axios.get<{ success: boolean; data: Semester }>(
          "http://localhost:3001/semester/current"
        );
        if (res.data.success) {
          const sem = res.data.data;
          const computedWeek = getCurrentAcademicWeek(sem.start_date);
          setSemester({
            ...sem,
            current_week: computedWeek
          });
          setSelectedWeek(computedWeek);
        }
      } catch (err) {
        console.error("Error fetching semester:", err);
      } finally {
        setLoadingSemester(false);
      }
    };

    fetchSemester();
    fetchActiveSessions();

    // Socket listeners...
    socket.on("checkinActivated", (data: any) => {
      console.log("🔔 EVENT RECEIVED:", data);
      console.log("📅 DATE COMPARISON:", {
        received: data.scheduled_date,
        type: typeof data.scheduled_date
      });

      const onlineMode = data.online_mode ?? data.onlineMode ?? false;
      setActiveSessions((prev) => ({
        ...prev,
        [data.class_id]: {
          session_id: data.session_id,
          startedAt: new Date(data.startedAt ?? data.started_at).toISOString(),
          expiresAt: new Date(data.expiresAt ?? data.expires_at).toISOString(),
          onlineMode: !!onlineMode,
          scheduled_date: data.scheduled_date,
        },
      }));
    });

    // FIX: Update the specific session in attendanceSessions array instead of a generic Set
    socket.on("studentCheckedIn", (data: any) => {
      if (data.student_id === user?.id) {
        setAttendanceSessions(prev => prev.map(session => {
            if (session.session_id === data.session_id) {
                return { ...session, student_status: 'present' };
            }
            return session;
        }));
        
        // Also update the summary count locally for immediate UI feedback
        setAttendanceSummaryByClass(prev => {
            const cls = prev[data.class_id];
            if (!cls) return prev;
            // Recalculate rudimentary stats if needed, or just let next fetch handle it
            // For now, let's just trust the next page refresh for deep stats to avoid complexity
            return prev; 
        });
      }
    });

    socket.on("sessionExpired", (data: any) => {
      // Remove from active
      setActiveSessions((prev) => {
        const copy = { ...prev };
        delete copy[data.class_id];
        return copy;
      });

      // Update history status to missed if not checked in
      setAttendanceSessions(prev => prev.map(session => {
          if (session.class_id === data.class_id && session.session_id === data.session_id) {
             if (session.student_status !== 'present' && session.student_status !== 'checked-in') {
                 return { ...session, student_status: 'missed' };
             }
          }
          return session;
      }));
    });

    return () => {
      socket.off("checkinActivated");
      socket.off("studentCheckedIn");
      socket.off("sessionExpired");
      socket.emit("leaveStudentRooms", user.id);
    };
  }, [user?.id]); 

  // ---------------------------------------------------------
  // 2. Fetch Attendance when Semester is Ready
  // ---------------------------------------------------------
  useEffect(() => {
    if (user && semester) {
        fetchAttendanceSemester();
    }
  }, [user, semester, fetchAttendanceSemester]);

  // ---------------------------------------------------------
  // 3. Fetch Schedule when Week Changes
  // ---------------------------------------------------------
  useEffect(() => {
    if (!user || !semester) return;
    fetchSchedule();
  }, [selectedWeek, user, semester, isViewingSemBreak, fetchSchedule]);

  // Auto-open today's accordion
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (Object.keys(weekSchedule).includes(today)) {
      setOpenDays([today]);
    }
  }, [weekSchedule]);

  const toggleDay = (day: string) => {
    if (openDays.includes(day)) {
      setOpenDays(openDays.filter(d => d !== day));
    } else {
      setOpenDays([...openDays, day]);
    }
  };

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

  // Helper to get Date Object for a day in the selected week
  const getDateObjForDay = (dayName: string): Date | null => {
    if (!semester) return null;
    const dayIndex = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[dayName] ?? 0;
    const semesterStart = new Date(semester.start_date);
    // Add weeks offset + day offset
    const targetDate = new Date(semesterStart);
    targetDate.setDate(semesterStart.getDate() + (selectedWeek - 1) * 7 + dayIndex);
    return targetDate;
  };

  const getDateForDay = (dayName: string): string => {
    const date = getDateObjForDay(dayName);
    return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  };

  const handleCheckIn = async (classId: number) => {
    if (!user) return;

    const session = activeSessions[classId];
    if (!session) {
      alert("No active session for this class");
      return;
    }

    if (!navigator.geolocation) {
      alert("❌ Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const response = await axios.post('http://localhost:3001/student/checkin', {
            student_id: user.id,
            session_id: session.session_id,
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy
          });

          if (response.data.success) {
             setAttendanceSessions(prev => {
                 const exists = prev.find(s => s.session_id === session.session_id);
                 if (exists) {
                     return prev.map(s => s.session_id === session.session_id ? { ...s, student_status: 'present' } : s);
                 }
                 
                 return [...prev, {
                     session_id: session.session_id,
                     class_id: classId,
                     started_at: session.startedAt, 
                     student_status: 'present',
                     scheduled_date: session.scheduled_date // <--- Pass this from activeSessions!
                 }];
             });
            alert("✅ Check-in successful!");
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || "Check-in failed";
          alert(`❌ ${errorMessage}`);
        }
      },
      (error) => {
        alert("❌ Unable to retrieve location. Please allow location access.");
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/student/analytics")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
            >
              Analytics
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Welcome Card */}
        <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6">
          <h2 className="text-xl mb-2">Welcome, {user?.name}!</h2>
          <p className="text-gray-400">Student ID: {user?.id}</p>
        </div>

        {/* Semester & Week Navigation */}
        {loadingSemester ? (
          <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6 text-center">
            <p className="text-gray-400">Loading semester information...</p>
          </div>
        ) : semester ? (
          <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] backdrop-blur-xl p-6 rounded-2xl border border-blue-500/20 mb-6 shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-blue-400 mb-1">{semester.name}</h2>
                <p className="text-gray-300">
                  {isViewingSemBreak ? (
                    <span className="text-orange-400 font-semibold text-xl">🏖️ Semester Break</span>
                  ) : (
                    <span>
                      Week <span className="font-bold text-white">{selectedWeek}</span> of 14
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreviousWeek}
                  disabled={!isViewingSemBreak && selectedWeek <= 1}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    (!isViewingSemBreak && selectedWeek <= 1)
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  ← Previous
                </button>
                {(selectedWeek !== semester.current_week || isViewingSemBreak) && (
                  <button
                    onClick={handleCurrentWeek}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition"
                  >
                    Current Week
                  </button>
                )}
                <button
                  onClick={handleNextWeek}
                  disabled={!isViewingSemBreak && selectedWeek >= 14}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    (!isViewingSemBreak && selectedWeek >= 14)
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-red-500/20 mb-6">
            <p className="text-red-400">⚠️ No active semester found</p>
          </div>
        )}

        {/* Weekly Schedule */}
        <div className="space-y-4">
          {Object.entries(weekSchedule).map(([day, classes]) => (
            <div
              key={day}
              className="rounded-2xl border border-white/10 overflow-hidden"
            >
              <button
                onClick={() => toggleDay(day)}
                className="w-full text-center px-4 py-3 font-semibold text-lg bg-[#181818]/80 hover:bg-[#222222]/80 transition-colors shadow-md border-b border-white/10"
              >
                {day} {semester && `(${getDateForDay(day)})`}
              </button>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  openDays.includes(day) ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                } bg-[#1f1f2a]`}
              >
                {classes.length === 0 ? (
                  <p className="text-gray-400 px-4 py-4 text-center">No classes today.</p>
                ) : (
                  classes.map((cls, idx) => {
                    // ------------------------------------------------------------------
                    // 🔍 FIXED LOGIC: Strict Date Matching + No Global Sets
                    // ------------------------------------------------------------------
                    
                    // 1. Calculate the Target Date (YYYY-MM-DD)
                    const rowDateObj = getDateObjForDay(day);
                    // Use 'en-CA' to get YYYY-MM-DD format which matches your backend
                    const rowIsoDate = rowDateObj ? rowDateObj.toLocaleDateString('en-CA') : "";

                    // 2. Find session by Matching SCHEDULED DATE (Reliable) instead of started_at
                    const sessionForThisWeek = attendanceSessions.find((s) => {
                        if (s.class_id !== cls.class_id) return false;
                        
                        // PRIMARY MATCH: Use the robust scheduled_date from DB/State
                        if (s.scheduled_date) {
                            return s.scheduled_date === rowIsoDate;
                        }
                        
                        // FALLBACK: If scheduled_date is missing (old data), try calculating from started_at
                        const sDate = new Date(s.started_at).toLocaleDateString('en-CA');
                        return sDate === rowIsoDate;
                    });

                    // Determine Status based ONLY on this specific session entry
                    const isCheckedIn = sessionForThisWeek?.student_status === "present" || 
                                        sessionForThisWeek?.student_status === "checked-in";

                    const isMissed = sessionForThisWeek?.student_status === "missed";

                    // Check for Active Session
                    let isActive = false;
                    const active = activeSessions[cls.class_id];
                    
                    if (active && rowDateObj) {
                        const rowIsoDate = rowDateObj.toLocaleDateString('en-CA'); 
                        if (active.scheduled_date === rowIsoDate && !isCheckedIn && !isMissed) {
                            isActive = true;
                        }
                    }

                    const analytics = attendanceSummaryByClass[cls.class_id];

                    return (
                      <div
                        key={cls.class_id}
                        className={`px-4 py-4 ${
                          idx < classes.length - 1 ? 'border-b border-white/10' : ''
                        } flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg text-white">
                              {cls.class_name} 
                            </h3>
                            <span className="text-sm bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                                {cls.course_code}
                            </span>
                            {analytics && (
                                <span className={`text-xs px-2 py-0.5 rounded border ${
                                    analytics.attendance_status === 'good' ? 'border-green-500 text-green-400' :
                                    analytics.attendance_status === 'warning' ? 'border-yellow-500 text-yellow-400' :
                                    'border-red-500 text-red-400'
                                }`}>
                                    {analytics.attendance_rate}% Att.
                                </span>
                            )}
                          </div>
                          
                          <p className="text-gray-400 text-sm mt-1">Lecturer: {cls.lecturer_name}</p>
                          <p className="text-gray-500 text-xs">{cls.class_type} • {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}</p>
                          
                          <div className="mt-2">
                             {isCheckedIn ? (
                              <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                                🟢 Checked In
                              </span>
                            ) : isMissed ? (
                              <span className="text-red-500 text-sm font-semibold flex items-center gap-1">
                                🔴 Missed
                              </span>
                            ) : isActive ? (
                              <span className="text-yellow-400 text-sm font-semibold flex items-center gap-1 animate-pulse">
                                🟡 Check-in Open
                              </span>
                            ) : (
                              <span className="text-gray-500 text-sm flex items-center gap-1">
                                ⚪ Pending
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCheckIn(cls.class_id)}
                          disabled={!isActive || isCheckedIn || isMissed}
                          className={`w-full md:w-auto px-6 py-2 rounded-lg transition font-medium shadow-lg
                            ${isCheckedIn
                              ? "bg-green-900/50 text-green-200 cursor-not-allowed border border-green-700/50"
                              : isMissed
                                ? "bg-red-900/50 text-red-200 cursor-not-allowed border border-red-700/50"
                                : isActive
                                  ? "bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20"
                                  : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"}`}
                        >
                          {isCheckedIn ? "Completed" : isMissed ? "Absent" : isActive ? "Check In Now" : "Not Available"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}