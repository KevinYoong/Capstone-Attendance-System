import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    if (!user) return;

    const fetchSchedule = async () => {
      try {
        const res = await axios.get<Week>(`http://localhost:3001/student/${user.id}/classes/week`);
        setWeekSchedule(res.data);
      } catch (err) {
        console.error('Error fetching schedule:', err);
      }
    };

    fetchSchedule();

    // Automatically open the current day
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (Object.keys(weekSchedule).includes(today)) {
      setOpenDays([today]);
    }
  }, [user]);

  const toggleDay = (day: string) => {
    if (openDays.includes(day)) {
      setOpenDays(openDays.filter(d => d !== day));
    } else {
      setOpenDays([...openDays, day]);
    }
  };

  const handleCheckIn = (classId: number) => {
    alert(`Check-in for class ${classId} clicked!`);
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
                        <p className="text-gray-400">Lecturer: {cls.lecturer_name}</p>
                        {statusBadge(cls.status)}
                      </div>
                      <button
                        onClick={() => handleCheckIn(cls.class_id)}
                        className="mt-2 md:mt-0 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition"
                      >
                        Check In
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
