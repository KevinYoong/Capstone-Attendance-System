import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { io } from "socket.io-client";
import axios from 'axios';

const socket = io("http://localhost:3001");

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
  }>>({});

  // Track which classes the student has checked into
  const [checkedInClasses, setCheckedInClasses] = useState<Set<number>>(new Set());

  // Semester and week navigation state
  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loadingSemester, setLoadingSemester] = useState<boolean>(true);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    if (!user) return;

    const fetchSemester = async () => {
      try {
        setLoadingSemester(true);
        const res = await axios.get<{success: boolean, data: Semester}>('http://localhost:3001/semester/current');
        if (res.data.success) {
          setSemester(res.data.data);
          setSelectedWeek(res.data.data.current_week);
        }
      } catch (err) {
        console.error('Error fetching semester:', err);
      } finally {
        setLoadingSemester(false);
      }
    };

    const fetchSchedule = async () => {
      try {
        const res = await axios.get<Week>(`http://localhost:3001/student/${user.id}/classes/week`);
        // Ensure all days are arrays (handle API errors gracefully)
        const schedule: Week = {
          Monday: Array.isArray(res.data.Monday) ? res.data.Monday : [],
          Tuesday: Array.isArray(res.data.Tuesday) ? res.data.Tuesday : [],
          Wednesday: Array.isArray(res.data.Wednesday) ? res.data.Wednesday : [],
          Thursday: Array.isArray(res.data.Thursday) ? res.data.Thursday : [],
          Friday: Array.isArray(res.data.Friday) ? res.data.Friday : [],
        };
        setWeekSchedule(schedule);
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

    fetchSemester();
    fetchSchedule();

    // Automatically open the current day
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (Object.keys(weekSchedule).includes(today)) {
      setOpenDays([today]);
    }

    // ----- SOCKET LISTENERS -----
    socket.on("checkinActivated", (data) => {
      console.log("Activated:", data);

      setActiveSessions((prev) => ({
        ...prev,
        [data.class_id]: {
          session_id: data.session_id,
          expiresAt: data.expiresAt
        }
      }));
    });

    // Listen for when ANY student checks in (including this student)
    socket.on("studentCheckedIn", (data) => {
      console.log("Student checked in:", data);

      // If this student checked in, update local state
      if (data.student_id === user?.id) {
        setCheckedInClasses(prev => new Set(prev).add(data.class_id));
      }
    });

    return () => {
      socket.off("checkinActivated");
      socket.off("studentCheckedIn");
    };

  }, [user]);

  const toggleDay = (day: string) => {
    if (openDays.includes(day)) {
      setOpenDays(openDays.filter(d => d !== day));
    } else {
      setOpenDays([...openDays, day]);
    }
  };

  const handlePreviousWeek = () => {
    if (selectedWeek > 1) {
      setSelectedWeek(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (semester && selectedWeek < semester.current_week) {
      setSelectedWeek(selectedWeek + 1);
    }
  };

  const handleCurrentWeek = () => {
    if (semester) {
      setSelectedWeek(semester.current_week);
    }
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
        // Successfully got location
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

  const statusBadge = (status?: string) => {
    switch (status) {
      case 'yellow':
        return <span className="text-yellow-400 font-semibold">🟡 Check-in open</span>;
      case 'green':
        return <span className="text-green-400 font-semibold">🟢 Checked in</span>;
      case 'red':
        return <span className="text-red-500 font-semibold">🔴 Missed</span>;
      default:
        return <span className="text-gray-400 font-semibold">⚪ Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            Logout
          </button>
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
                  {semester.is_sem_break ? (
                    <span className="text-orange-400 font-semibold">🏖️ Semester Break</span>
                  ) : (
                    <span>
                      Week <span className="font-bold text-white">{selectedWeek}</span> of {semester.current_week}
                    </span>
                  )}
                </p>
              </div>

              {/* Week Navigation Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreviousWeek}
                  disabled={selectedWeek <= 1}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    selectedWeek <= 1
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title="Previous Week"
                >
                  ← Previous
                </button>

                {selectedWeek !== semester.current_week && (
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
                  disabled={selectedWeek >= semester.current_week}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    selectedWeek >= semester.current_week
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
                {day}
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
                  const isActive = activeSessions[cls.class_id] !== undefined;
                  const isCheckedIn = checkedInClasses.has(cls.class_id);

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
                        {isCheckedIn
                          ? <span className="text-green-400 font-semibold">🟢 Checked in</span>
                          : isActive
                            ? <span className="text-yellow-400 font-semibold">🟡 Check-in open</span>
                            : <span className="text-gray-400 font-semibold">⚪ Pending</span>
                        }
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