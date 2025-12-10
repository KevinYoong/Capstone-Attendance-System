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
    expiresAt: string;
    onlineMode: boolean;
  }>>({});

  // Track which classes the student has checked into
  const [checkedInClasses, setCheckedInClasses] = useState<Set<number>>(new Set());

  // Track which sessions were missed (expired without check-in)
  const [missedSessions, setMissedSessions] = useState<Set<number>>(new Set());

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

      // Map into activeSessions shape: { [classId]: { session_id, expiresAt, onlineMode } }
      const map: Record<number, { session_id: number; expiresAt: string; onlineMode: boolean }> = {};

      res.data.sessions.forEach((s: any) => {
        map[s.class_id] = {
          session_id: s.session_id,
          expiresAt: new Date(s.expires_at).toISOString(),
          onlineMode: !!s.online_mode,
        };
      });

      setActiveSessions((prev) => ({ ...prev, ...map }));
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

      // Build lookup map for class summaries
      const map: Record<number, any> = {};
      summary.forEach((s: any) => {
        map[s.class_id] = s;
      });
      setAttendanceSummaryByClass(map);

      // Reconstruct persistent check-in / missed states
      const checkedSet = new Set<number>();
      const missedSet = new Set<number>();

      attendance.forEach((sess: any) => {
        if (sess.student_status === "present") checkedSet.add(sess.class_id);
        else if (sess.student_status === "missed") missedSet.add(sess.class_id);
      });

      setCheckedInClasses(checkedSet);
      setMissedSessions(missedSet);

    } catch (err) {
      console.error("Error fetching attendance semester:", err);
    }
  }, [user?.id, semester]);

  useEffect(() => {
    if (!user) return;

    // 1) join student rooms first (so socket emits from server that use rooms are honored)
    socket.emit("joinStudentRooms", user.id);

    // 2) fetch semester and schedule (existing)
    const fetchSemester = async () => {
      try {
        setLoadingSemester(true);
        const res = await axios.get<{ success: boolean; data: Semester }>(
          "http://localhost:3001/semester/current"
        );
        if (res.data.success) {
          setSemester(res.data.data);
          setSelectedWeek(res.data.data.current_week);
          await fetchAttendanceSemester();
        }
      } catch (err) {
        console.error("Error fetching semester:", err);
      } finally {
        setLoadingSemester(false);
      }
    };

    fetchSemester();
    fetchSchedule(); 

    // 3) **new**: fetch active sessions immediately (so newly-logged students see already-activated sessions)
    fetchActiveSessions();

    // ----- SOCKET LISTENERS -----
    socket.on("checkinActivated", (data: any) => {
      console.log("Activated:", data);

      // support both server naming variants: online_mode or onlineMode
      const onlineMode = data.online_mode ?? data.onlineMode ?? false;

      setActiveSessions((prev) => ({
        ...prev,
        [data.class_id]: {
          session_id: data.session_id,
          expiresAt: data.expiresAt ?? data.expires_at ?? new Date().toISOString(),
          onlineMode: !!onlineMode,
        },
      }));
    });

    socket.on("studentCheckedIn", (data: any) => {
      console.log("Student checked in:", data);
      if (data.student_id === user?.id) {
        setCheckedInClasses((prev) => new Set(prev).add(data.class_id));
      }
    });

    socket.on("sessionExpired", (data: any) => {
      console.log("🔴 Session expired:", data);

      // If student didn't check in, mark missed
      setCheckedInClasses((prevChecked) => {
        const wasCheckedIn = prevChecked.has(data.class_id);
        if (!wasCheckedIn) {
          setMissedSessions((prev) => new Set(prev).add(data.class_id));
        }
        return prevChecked;
      });

      // Remove active session entry
      setActiveSessions((prev) => {
        const copy = { ...prev };
        delete copy[data.class_id];
        return copy;
      });
    });

    return () => {
      socket.off("checkinActivated");
      socket.off("studentCheckedIn");
      socket.off("sessionExpired");
      socket.emit("leaveStudentRooms", user.id);
    };
  }, [user, fetchSchedule, fetchActiveSessions]);

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (Object.keys(weekSchedule).includes(today)) {
      setOpenDays([today]);
    }
  }, [weekSchedule]);

  // Refetch schedule when selectedWeek changes
  useEffect(() => {
    if (!user || !semester) return;
    fetchSchedule();
  }, [selectedWeek, user, semester, isViewingSemBreak, fetchSchedule]);

  const toggleDay = (day: string) => {
    if (openDays.includes(day)) {
      setOpenDays(openDays.filter(d => d !== day));
    } else {
      setOpenDays([...openDays, day]);
    }
  };

  const handlePreviousWeek = () => {
    if (isViewingSemBreak) {
      // From sem break, go back to week 7
      setIsViewingSemBreak(false);
      setSelectedWeek(7);
    } else if (selectedWeek === 8) {
      // From week 8, go to sem break
      setIsViewingSemBreak(true);
    } else if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (isViewingSemBreak) {
      // From sem break, go to week 8
      setIsViewingSemBreak(false);
      setSelectedWeek(8);
    } else if (selectedWeek === 7) {
      // From week 7, go to sem break
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

  const handleCheckIn = async (classId: number) => {
    if (!user) return;

    const session = activeSessions[classId];
    if (!session) {
      alert("No active session for this class");
      return;
    }

    // Request geolocation from browser
    if (!navigator.geolocation) {
      alert("❌ Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Log location for testing 
        console.log(
          "📍 Student Location:",
          {
            latitude,
            longitude,
            accuracy
          }
        );

        try {
          const response = await axios.post('http://localhost:3001/student/checkin', {
            student_id: user.id,
            session_id: session.session_id,
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy
          });

          if (response.data.success) {
            // Mark this class as checked in
            setCheckedInClasses(prev => new Set(prev).add(classId));
            alert("✅ Check-in successful!");
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || "Check-in failed";
          alert(`❌ ${errorMessage}`);
          console.error("Check-in error:", error);
        }
      },
      (error) => {
        // Failed to get location
        let errorMessage = "Unable to retrieve your location";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please try again.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }

        alert(`❌ ${errorMessage}`);
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true, // Request GPS if available
        timeout: 10000, // 10 second timeout
        maximumAge: 0 // Don't use cached position
      }
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
                    (!isViewingSemBreak && selectedWeek <= 1)
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
                    (!isViewingSemBreak && selectedWeek >= 14)
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
              {/* Day Header */}
              <button
                onClick={() => toggleDay(day)}
                className="w-full text-center px-4 py-3 font-semibold text-lg bg-[#181818]/80 hover:bg-[#222222]/80 transition-colors shadow-md border border-white/10 rounded-t-2xl"
                style={{
                  boxShadow: '0 2px 6px rgba(255, 255, 255, 0.05), 0 0 10px rgba(255, 255, 255, 0.05)',
                }}
              >
                {day} {semester && `(${getDateForDay(day)})`}
              </button>

              {/* Classes */}
              <div
                className={`transition-max-height duration-500 ease-in-out overflow-hidden ${
                  openDays.includes(day) ? 'max-h-screen' : 'max-h-0'
                } bg-gradient-to-r from-[#1f1f2a] via-[#222233] to-[#1f1f2a]`}
              >
                {classes.length === 0 ? (
                  <p className="text-gray-400 px-4 py-2 text-center">No classes today.</p>
                ) : (
                  classes.map((cls, idx) => {
                  // Determine week range
                  if (!semester) return null; // Prevent rendering before semester loads
                  const semesterStart = new Date(semester.start_date);
                  const start = new Date(semesterStart);
                  start.setDate(start.getDate() + (selectedWeek - 1) * 7);
                  const end = new Date(start);
                  end.setDate(start.getDate() + 6);

                  // Find session for this class in this week
                  const sessionForThisWeek = attendanceSessions.find(
                    (s) =>
                      s.class_id === cls.class_id &&
                      new Date(s.started_at) >= start &&
                      new Date(s.started_at) <= end
                  );

                  // Determine status
                  const isCheckedIn = sessionForThisWeek?.student_status === "present";
                  const isMissed = sessionForThisWeek?.student_status === "missed";
                  const isActive =
                    activeSessions[cls.class_id] !== undefined &&
                    !isCheckedIn &&
                    !isMissed;

                  return (
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
                        <p className="text-gray-400">Lecturer: {cls.lecturer_name}</p>
                        {isCheckedIn ? (
                          <span className="text-green-400 font-semibold">🟢 Checked in</span>
                        ) : isMissed ? (
                          <span className="text-red-500 font-semibold">🔴 Missed</span>
                        ) : isActive ? (
                          <span className="text-yellow-400 font-semibold">🟡 Check-in open</span>
                        ) : (
                          <span className="text-gray-400 font-semibold">⚪ Pending</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCheckIn(cls.class_id)}
                        disabled={!isActive || isCheckedIn}
                        className={`mt-2 md:mt-0 px-4 py-2 rounded-lg transition
                          ${isCheckedIn
                            ? "bg-green-600 cursor-not-allowed text-white"
                            : isActive
                              ? "bg-yellow-500 hover:bg-yellow-400 text-black"
                              : "bg-gray-600 cursor-not-allowed text-gray-300"}`}
                      >
                        {isCheckedIn ? "✓ Checked In" : isActive ? "Check In" : "Not Available"}
                      </button>
                       {isActive && activeSessions[cls.class_id]?.onlineMode && (
                          <span className="text-blue-400 font-semibold text-sm block mt-1">
                            Online Session — No GPS Required
                          </span>
                        )}
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