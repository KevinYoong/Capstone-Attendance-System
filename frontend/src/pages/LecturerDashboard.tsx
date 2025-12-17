import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';

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

function formatLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LecturerDashboard() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const restoreWeek = location.state?.restoreWeek;
  const restoreSemBreak = location.state?.restoreSemBreak;

  const [weekSchedule, setWeekSchedule] = useState<Week>({
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
  });
  const [openDays, setOpenDays] = useState<string[]>([]);

  // Track which sessions are currently active (check-in activated)
  const [activeSessions, setActiveSessions] = useState<Record<number, string>>({});

  // Track which classes had active sessions by class_id and date (format: "classId_YYYY-MM-DD")
  const [pastActivatedSessions, setPastActivatedSessions] = useState<Set<string>>(new Set());

  // Semester and week navigation state
  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loadingSemester, setLoadingSemester] = useState<boolean>(true);
  const [isViewingSemBreak, setIsViewingSemBreak] = useState<boolean>(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Fetch active sessions for all classes in the current week
  const fetchActiveSessionsForWeek = async (classes: Class[]) => {
  const map: Record<number, string> = {}; 

  for (const cls of classes) {
    try {
      const res = await axios.get(
        `http://localhost:3001/lecturer/class/${cls.class_id}/active-session`
      );

      // If active, save the Expiry Time. If not, ignore.
      if (res.data?.session && !res.data.session.is_expired) {
        map[cls.class_id] = res.data.session.expires_at; 
      }
    } catch (err) {
      console.error("Error fetching active session for class:", cls.class_id, err);
    }
  }

  setActiveSessions(map);
};

useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();

    setActiveSessions((prevSessions) => {
      const nextSessions = { ...prevSessions };
      let hasChanges = false;

      Object.entries(nextSessions).forEach(([classIdStr, expiresAt]) => {
        // If expired
        if (expiresAt && new Date(expiresAt) < now) {
          const classId = Number(classIdStr);
          
          // 1. Remove from Active
          delete nextSessions[classId]; 
          
          setPastActivatedSessions(prev => {
             const newSet = new Set(prev);
             // We assume the expired session happened "today" for the dashboard view
             const todayStr = formatLocalYMD(new Date()); 
             newSet.add(`${classId}_${todayStr}`);
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

  useEffect(() => {
    if (!user) return;

    const fetchSemester = async () => {
      try {
        setLoadingSemester(true);
        const res = await axios.get<{success: boolean, data: Semester}>('http://localhost:3001/semester/current');
        if (res.data.success) {
          const sem = res.data.data;
          const computedWeek = getCurrentAcademicWeek(sem.start_date);
          setSemester({
            ...sem,
            current_week: computedWeek
          });
          setSelectedWeek(restoreWeek ?? computedWeek);
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
        // Ensure all days are arrays (handle API errors gracefully)
        const schedule: Week = {
          Monday: Array.isArray(res.data.Monday) ? res.data.Monday : [],
          Tuesday: Array.isArray(res.data.Tuesday) ? res.data.Tuesday : [],
          Wednesday: Array.isArray(res.data.Wednesday) ? res.data.Wednesday : [],
          Thursday: Array.isArray(res.data.Thursday) ? res.data.Thursday : [],
          Friday: Array.isArray(res.data.Friday) ? res.data.Friday : [],
        };
        setWeekSchedule(schedule);
        const allClasses = [
          ...schedule.Monday,
          ...schedule.Tuesday,
          ...schedule.Wednesday,
          ...schedule.Thursday,
          ...schedule.Friday
        ];
        fetchActiveSessionsForWeek(allClasses);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        // Set empty schedule on error
        setWeekSchedule({
          Monday: [],
          Tuesday: [],
          Wednesday: [],
          Thursday: [],
          Friday: [],
        });
      }
    };

    const fetchPastActivations = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3001/lecturer/${user.id}/attendance/semester`
        );

        if (!res.data?.success) return;

        const classList = res.data.classes || [];
        const set = new Set<string>();
 
        classList.forEach((c: any) => {
          if (c.sessions && c.sessions.length > 0) {
            c.sessions.forEach((session: any) => {
              const localDate = formatLocalYMD(new Date(session.started_date));
              const key = `${c.class_id}_${localDate}`;
              set.add(key);
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

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (Object.keys(weekSchedule).includes(today)) {
      setOpenDays([today]);
    }
  }, [user]);

  // Refetch schedule when selectedWeek changes
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
          ...schedule.Monday,
          ...schedule.Tuesday,
          ...schedule.Wednesday,
          ...schedule.Thursday,
          ...schedule.Friday
        ];

        fetchActiveSessionsForWeek(allClasses);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setWeekSchedule({
          Monday: [],
          Tuesday: [],
          Wednesday: [],
          Thursday: [],
          Friday: [],
        });
      }
    };

    fetchSchedule();
  }, [selectedWeek, user, semester, isViewingSemBreak]);

  const toggleDay = (day: string) => {
    setOpenDays(openDays.includes(day) ? openDays.filter(d => d !== day) : [...openDays, day]);
  };

  const handlePreviousWeek = () => {
    if (isViewingSemBreak) {
      // Going back from semester break to Week 7
      setIsViewingSemBreak(false);
      setSelectedWeek(7);
    } else if (selectedWeek === 8) {
      // Going back from Week 8 to semester break
      setIsViewingSemBreak(true);
    } else if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (isViewingSemBreak) {
      // Going forward from semester break to Week 8
      setIsViewingSemBreak(false);
      setSelectedWeek(8);
    } else if (selectedWeek === 7) {
      // Going forward from Week 7 to semester break
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

  // Helper function to calculate the date for a given day in the selected week
  const getDateForDay = (dayName: string): string => {
    if (!semester) return '';

    const dayIndex = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[dayName] || 0;
    const semesterStart = new Date(semester.start_date);

    // Calculate days offset: (selectedWeek - 1) * 7 days + dayIndex
    const daysOffset = (selectedWeek - 1) * 7 + dayIndex;
    const targetDate = new Date(semesterStart);
    targetDate.setDate(semesterStart.getDate() + daysOffset);

    // Format as "Jan 6"
    return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper function to get full date in YYYY-MM-DD format for checking past activations
  const getFullDateForDay = (dayName: string): string => {
    if (!semester) return '';

    const dayIndex = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }[dayName] || 0;
    const semesterStart = new Date(semester.start_date);

    const daysOffset = (selectedWeek - 1) * 7 + dayIndex;
    const targetDate = new Date(semesterStart);
    targetDate.setDate(semesterStart.getDate() + daysOffset);

    // FIXED: Use local YYYY-MM-DD
    return targetDate.toLocaleDateString("en-CA"); 
  };

  const handleActivateCheckIn = (classId: number, day: string) => {
    navigate(`/lecturer/class/${classId}`, {
      state: { fromWeek: selectedWeek, fromSemBreak: isViewingSemBreak, sessionDate: getFullDateForDay(day) }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lecturer Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/lecturer/analytics")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
            >
              Analytics
            </button>

            {/* Logout Button */}
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
          <p className="text-gray-400">Email: {user?.email}</p>
          <p className="text-gray-400">Lecturer ID: {user?.id}</p>
        </div>

        {/* Semester & Week Navigation */}
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
                      Week <span className="font-bold text-white">{selectedWeek}</span> of 14
                    </span>
                  )}
                </p>
              </div>

              {/* Week Navigation Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreviousWeek}
                  disabled={!isViewingSemBreak && selectedWeek <= 1}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    !isViewingSemBreak && selectedWeek <= 1
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title="Previous Week"
                >
                  ← Previous
                </button>

                {(selectedWeek !== semester.current_week || isViewingSemBreak) && (
                  <button
                    onClick={handleCurrentWeek}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition"
                    title="Go to Current Week"
                  >
                    Current Week
                  </button>
                )}

                <button
                  onClick={handleNextWeek}
                  disabled={!isViewingSemBreak && selectedWeek >= 14}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    !isViewingSemBreak && selectedWeek >= 14
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title="Next Week"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Week Status Indicator */}
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

        {/* Weekly Schedule */}
        <div className="space-y-4">
          {Object.entries(weekSchedule).map(([day, classes]) => (
            <div
              key={day}
              className="rounded-2xl border border-white/10 overflow-hidden transition-all duration-500 ease-in-out"
            >
              <button
                onClick={() => toggleDay(day)}
                className="w-full text-center px-4 py-3 font-semibold text-lg bg-[#181818]/80 hover:bg-[#222222]/80 transition-colors shadow-md border border-white/10 rounded-t-2xl"
              >
                {day} {semester && `(${getDateForDay(day)})`}
              </button>

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
                       <button
                        onClick={() => handleActivateCheckIn(cls.class_id, day)}
                        className={`mt-2 md:mt-0 px-4 py-2 text-white rounded-lg transition ${
                          // Check if it exists (truthy)
                          activeSessions[cls.class_id]
                            ? "bg-green-600 hover:bg-green-500"                            
                            : pastActivatedSessions.has(`${cls.class_id}_${getFullDateForDay(day)}`)
                              ? "bg-blue-600 hover:bg-blue-500"
                              : "bg-gray-500 hover:bg-gray-400"
                        }`}
                      >
                        {activeSessions[cls.class_id]
                          ? "Active Now"
                          : pastActivatedSessions.has(`${cls.class_id}_${getFullDateForDay(day)}`)
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