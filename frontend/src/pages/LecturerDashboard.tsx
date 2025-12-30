import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ==========================================
// Types & Interfaces
// ==========================================

interface Class {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_type: string;
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

// Map of class_id -> expiration_time_string
type ActiveSessionMap = Record<number, { expiresAt: string; weekNumber: number }>;

// ==========================================
// Helper Functions
// ==========================================

/**
 * Calculates the academic week number (1-14) based on semester start date.
 */
function getCurrentAcademicWeek(startDateStr: string): number {
  const startDate = new Date(startDateStr);
  const today = new Date();

  // Normalize times to midnight
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Week 1 = days 0–6 → week = 1 + (days / 7)
  const week = Math.floor(diffDays / 7) + 1;

  return Math.max(1, week);
}

function getTotalWeeks(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); 
  return Math.ceil(diffDays / 7);
}

// ==========================================
// Component: LecturerDashboard
// ==========================================

export default function LecturerDashboard() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation State Restoration
  const restoreWeek = location.state?.restoreWeek;
  const restoreSemBreak = location.state?.restoreSemBreak;

  // ------------------------------------------
  // State Management
  // ------------------------------------------
  const [weekSchedule, setWeekSchedule] = useState<Week>({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [],
  });
  
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionMap>({});
  
  // Set of strings "classId_YYYY-MM-DD" for tracking past activations
  const [pastActivatedSessions, setPastActivatedSessions] = useState<Set<string>>(new Set());

  // Semester Navigation
  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loadingSemester, setLoadingSemester] = useState<boolean>(true);
  const [isViewingSemBreak, setIsViewingSemBreak] = useState<boolean>(false);
  const totalCalendarWeeks = semester ? getTotalWeeks(semester.start_date, semester.end_date) : 15;
  const totalAcademicWeeks = totalCalendarWeeks - 1;

  // ------------------------------------------
  // Handlers
  // ------------------------------------------
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleDay = (day: string) => {
    setOpenDays(openDays.includes(day) ? openDays.filter(d => d !== day) : [...openDays, day]);
  };

  // ------------------------------------------
  // Navigation Logic (Previous/Next/Current)
  // ------------------------------------------
  // 1. Calculate total weeks dynamically
  const totalWeeks = semester ? getTotalWeeks(semester.start_date, semester.end_date) : 14;

  const handlePreviousWeek = () => {
    if (isViewingSemBreak) {
      setIsViewingSemBreak(false);
      setSelectedWeek(7);
    } else if (selectedWeek === 9) { 
      setIsViewingSemBreak(true);
    } else if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (isViewingSemBreak) {
      setIsViewingSemBreak(false);
      setSelectedWeek(9);
    } else if (selectedWeek === 7) {
      setIsViewingSemBreak(true);
    } else if (selectedWeek < totalCalendarWeeks) {
      setSelectedWeek(selectedWeek + 1);
    }
  };

  const handleCurrentWeek = () => {
    if (semester) {
      // 1. Calculate the raw week number based on today's date
      const current = getCurrentAcademicWeek(semester.start_date);

      // 2. Handle the Semester Break (Week 8)
      if (current === 8) {
        setIsViewingSemBreak(true);
        setSelectedWeek(8);
      } else {
        setIsViewingSemBreak(false);

        // 3. CLAMP: Ensure we don't go past the last calendar week (e.g. Week 15)
        // If 'current' is 20, this forces it back to 15.
        const maxWeeks = getTotalWeeks(semester.start_date, semester.end_date);
        const clampedWeek = Math.min(current, maxWeeks);
        
        setSelectedWeek(clampedWeek);
      }
    }
  };

  // ------------------------------------------
  // Date Helpers for UI
  // ------------------------------------------
  const getDateForDay = (dayName: string): string => {
    if (!semester) return '';
    const dayIndex = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[dayName] || 0;
    const semesterStart = new Date(semester.start_date);
    const daysOffset = (selectedWeek - 1) * 7 + dayIndex;
    
    const targetDate = new Date(semesterStart);
    targetDate.setDate(semesterStart.getDate() + daysOffset);
    return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFullDateForDay = (dayName: string): string => {
    if (!semester) return '';
    const dayIndex = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[dayName] || 0;
    const semesterStart = new Date(semester.start_date);
    const daysOffset = (selectedWeek - 1) * 7 + dayIndex;
    
    const targetDate = new Date(semesterStart);
    targetDate.setDate(semesterStart.getDate() + daysOffset);
    return targetDate.toLocaleDateString("en-CA"); 
  };

  const handleActivateCheckIn = (classId: number, day: string) => {
    navigate(`/lecturer/class/${classId}`, {
      state: { fromWeek: selectedWeek, fromSemBreak: isViewingSemBreak, sessionDate: getFullDateForDay(day) }
    });
  };

  // ------------------------------------------
  // API: Fetch Active Sessions
  // ------------------------------------------
  const fetchActiveSessionsForWeek = async (classes: Class[]) => {
    const map: ActiveSessionMap = {}; 
    for (const cls of classes) {
      try {
        const res = await axios.get(
          `http://localhost:3001/lecturer/class/${cls.class_id}/active-session`
        );
        if (res.data?.session && !res.data.session.is_expired) {
          map[cls.class_id] = {
            expiresAt: res.data.session.expires_at,
            weekNumber: res.data.session.week_number 
          };
        }
      } catch (err) {
        console.error("Error fetching active session for class:", cls.class_id, err);
      }
    }
    setActiveSessions(map);
  };

  // ------------------------------------------
  // Effects
  // ------------------------------------------

  // 1. Session Expiry Timer (runs every second)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      setActiveSessions((prevSessions) => {
        const nextSessions = { ...prevSessions };
        let hasChanges = false;

        Object.entries(nextSessions).forEach(([classIdStr, sessionData]) => {
          if (sessionData?.expiresAt && new Date(sessionData.expiresAt) < now) {
            const classId = Number(classIdStr);
            
            // Remove from Active
            delete nextSessions[classId]; 
            
            // Add to Past Sessions
            setPastActivatedSessions(prev => {
               const newSet = new Set(prev);
               const key = `${classId}_W${sessionData.weekNumber}`;
               newSet.add(key);
               return newSet;
            });

            hasChanges = true;
          }
        });

        return hasChanges ? nextSessions : prevSessions;
      });
    }, 1000); 

    return () => clearInterval(interval);
  }, []);

  // 2. Initial Data Load (Semester, Schedule, History)
  useEffect(() => {
    if (!user) return;

    const fetchSemester = async () => {
      try {
        setLoadingSemester(true);
        const res = await axios.get<{success: boolean, data: Semester}>('http://localhost:3001/semester/current');
        if (res.data.success) {
          const sem = res.data.data;
          const computedWeek = getCurrentAcademicWeek(sem.start_date);
          const maxWeeks = getTotalWeeks(sem.start_date, sem.end_date);
          const clampedWeek = Math.min(computedWeek, maxWeeks);
          setSemester({ ...sem, current_week: clampedWeek });
          
          setSelectedWeek(restoreWeek ?? clampedWeek);
          setIsViewingSemBreak(restoreSemBreak ?? false);
        }
      } catch (err) {
        console.error('Error fetching semester:', err);
      } finally {
        setLoadingSemester(false);
      }
    };

    const fetchSchedule = async (week?: number) => {
      try {
        const weekParam = week || selectedWeek;
        const res = await axios.get<Week>(
          `http://localhost:3001/lecturer/${user.id}/classes/week?week=${isViewingSemBreak ? "break" : weekParam}`
        );
        
        const schedule: Week = {
          Monday: Array.isArray(res.data.Monday) ? res.data.Monday : [],
          Tuesday: Array.isArray(res.data.Tuesday) ? res.data.Tuesday : [],
          Wednesday: Array.isArray(res.data.Wednesday) ? res.data.Wednesday : [],
          Thursday: Array.isArray(res.data.Thursday) ? res.data.Thursday : [],
          Friday: Array.isArray(res.data.Friday) ? res.data.Friday : [],
        };
        
        setWeekSchedule(schedule);
        
        const allClasses = [
          ...schedule.Monday, ...schedule.Tuesday, ...schedule.Wednesday, ...schedule.Thursday, ...schedule.Friday
        ];
        fetchActiveSessionsForWeek(allClasses);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setWeekSchedule({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] });
      }
    };

    const fetchPastActivations = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/lecturer/${user.id}/attendance/semester`);
        if (!res.data?.success) return;

        const classList = res.data.classes || [];
        const set = new Set<string>();
 
        classList.forEach((c: any) => {
          if (c.sessions && c.sessions.length > 0) {
            c.sessions.forEach((session: any) => {
              // 1. Store Week Key
              set.add(`${c.class_id}_W${session.week_number}`);
              
              // 2. Store Date Key (Fallback for shifted semesters)
              // Use scheduled_date if available, else started_date
              const dateStr = session.scheduled_date 
                ? new Date(session.scheduled_date).toLocaleDateString("en-CA") 
                : new Date(session.started_at).toLocaleDateString("en-CA");
              
              set.add(`${c.class_id}_${dateStr}`);
            });
          }
        });
        setPastActivatedSessions(set);
      } catch (err) {
        console.error("Error fetching past activations:", err);
      }
    };

    fetchSemester();
    fetchSchedule();
    fetchPastActivations();

    // Auto-open today's schedule
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (Object.keys({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }).includes(today)) {
      setOpenDays([today]);
    }
  }, [user]);

  // 3. Refetch Schedule on Week Change
  useEffect(() => {
    if (!user || !semester) return;

    const fetchSchedule = async () => {
      try {
        const res = await axios.get<Week>(
          `http://localhost:3001/lecturer/${user.id}/classes/week?week=${isViewingSemBreak ? "break" : selectedWeek}`
        );
        const schedule: Week = {
          Monday: Array.isArray(res.data.Monday) ? res.data.Monday : [],
          Tuesday: Array.isArray(res.data.Tuesday) ? res.data.Tuesday : [],
          Wednesday: Array.isArray(res.data.Wednesday) ? res.data.Wednesday : [],
          Thursday: Array.isArray(res.data.Thursday) ? res.data.Thursday : [],
          Friday: Array.isArray(res.data.Friday) ? res.data.Friday : [],
        };
        setWeekSchedule(schedule);
        
        const allClasses = [
          ...schedule.Monday, ...schedule.Tuesday, ...schedule.Wednesday, ...schedule.Thursday, ...schedule.Friday
        ];
        fetchActiveSessionsForWeek(allClasses);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setWeekSchedule({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] });
      }
    };

    fetchSchedule();
  }, [selectedWeek, user, semester, isViewingSemBreak]);

  // ------------------------------------------
  // Main Render
  // ------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* --- Header --- */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lecturer Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/lecturer/analytics")}
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

        {/* --- Welcome Card --- */}
        <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6">
          <h2 className="text-xl mb-2">Welcome, {user?.name}!</h2>
          <p className="text-gray-400">Email: {user?.email}</p>
          <p className="text-gray-400">Lecturer ID: {user?.id}</p>
        </div>

        {/* --- Semester Navigation --- */}
        {loadingSemester ? (
          <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6 text-center">
            <p className="text-gray-400">Loading semester information...</p>
          </div>
        ) : semester ? (
          <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] backdrop-blur-xl p-6 rounded-2xl border border-blue-500/20 mb-6 shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              
              {/* Semester Info */}
              <div>
                <h2 className="text-2xl font-bold text-blue-400 mb-1">{semester.name}</h2>
                <p className="text-gray-300">
                  {isViewingSemBreak ? (
                    <span className="text-orange-400 font-semibold text-xl">🏖️ Semester Break</span>
                  ) : (
                    <span>
                      Week <span className="font-bold text-white">{selectedWeek > 7 ? selectedWeek - 1 : selectedWeek}</span> of {totalAcademicWeeks}
                    </span>
                  )}
                </p>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreviousWeek}
                  disabled={!isViewingSemBreak && selectedWeek <= 1}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    !isViewingSemBreak && selectedWeek <= 1
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
                  disabled={!isViewingSemBreak && selectedWeek >= totalCalendarWeeks}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    !isViewingSemBreak && selectedWeek >= totalWeeks
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Week Status Indicators */}
            {isViewingSemBreak ? (
              <div className="mt-4 pt-4 border-t border-orange-500/20">
                <p className="text-sm text-orange-400 font-semibold">
                  🏖️ Semester break period - No classes scheduled
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Located between Week 7 and Week 8
                </p>
              </div>
            ) : (
              <>
                {selectedWeek === semester.current_week && (
                  <div className="mt-4 pt-4 border-t border-blue-500/20">
                    <p className="text-sm text-green-400 font-semibold">
                      ✓ You are viewing the current week
                    </p>
                  </div>
                )}
                {selectedWeek < semester.current_week && (
                  <div className="mt-4 pt-4 border-t border-blue-500/20">
                    <p className="text-sm text-yellow-400 font-semibold">
                      ⚠️ You are viewing a past week
                    </p>
                  </div>
                )}
                {selectedWeek > semester.current_week && (
                  <div className="mt-4 pt-4 border-t border-blue-500/20">
                    <p className="text-sm text-blue-400 font-semibold">
                      🔮 You are viewing a future week
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-red-500/20 mb-6">
            <p className="text-red-400">⚠️ No active semester found</p>
          </div>
        )}

        {/* --- Weekly Schedule --- */}
        <div className="space-y-4">
          {Object.entries(weekSchedule).map(([day, classes]) => (
            <div
              key={day}
              className="rounded-2xl border border-white/10 overflow-hidden transition-all duration-500 ease-in-out"
            >
              {/* Day Accordion Header */}
              <button
                onClick={() => toggleDay(day)}
                className="w-full text-center px-4 py-3 font-semibold text-lg bg-[#181818]/80 hover:bg-[#222222]/80 transition-colors shadow-md border border-white/10 rounded-t-2xl"
              >
                {day} {semester && `(${getDateForDay(day)})`}
              </button>

              {/* Day Content */}
              <div
                className={`transition-max-height duration-500 ease-in-out overflow-hidden ${
                  openDays.includes(day) ? 'max-h-screen' : 'max-h-0'
                } bg-gradient-to-r from-[#1f1f2a] via-[#222233] to-[#1f1f2a]`}
              >
                {classes.length === 0 ? (
                  <p className="text-gray-400 px-4 py-2 text-center">No classes today.</p>
                ) : (
                  classes.map((cls, idx) => (
                    <div
                      key={cls.class_id}
                      className={`px-4 py-3 ${
                        idx < classes.length - 1 ? 'border-b border-white/20' : ''
                      } flex flex-col md:flex-row justify-between items-start md:items-center gap-2`}
                    >
                      <div>
                        <h3 className="font-semibold text-lg">
                          {cls.class_name} ({cls.course_code})
                        </h3>
                        <p className="text-gray-400">
                          {cls.start_time} - {cls.end_time} ({cls.class_type})
                        </p>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleActivateCheckIn(cls.class_id, day)}
                        className={`mt-2 md:mt-0 px-4 py-2 text-white rounded-lg transition ${
                          activeSessions[cls.class_id]
                            ? "bg-green-600 hover:bg-green-500"
                            : (pastActivatedSessions.has(`${cls.class_id}_W${selectedWeek}`) || 
                               pastActivatedSessions.has(`${cls.class_id}_${getFullDateForDay(day)}`))
                              ? "bg-blue-600 hover:bg-blue-500"
                              : "bg-gray-500 hover:bg-gray-400"
                        }`}
                      >
                        {activeSessions[cls.class_id]?.weekNumber === selectedWeek
                          ? "Active Now"
                          : (pastActivatedSessions.has(`${cls.class_id}_W${selectedWeek}`) || 
                             pastActivatedSessions.has(`${cls.class_id}_${getFullDateForDay(day)}`))
                            ? "Previously Activated"
                            : "Activate Check-In"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}