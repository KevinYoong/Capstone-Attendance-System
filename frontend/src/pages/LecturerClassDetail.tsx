import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import socket from "../utils/socket";

// ==========================================
// Types & Interfaces
// ==========================================

interface Student {
  student_id: number;
  name: string;
  email: string;
  status: "checked-in" | "missed" | "pending";
}

interface ClassInfo {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  class_type: string;
  lecturer_name: string;
}

interface Session {
  session_id: number;
  started_at: string;
  expires_at: string;
  online_mode?: boolean;
  is_expired?: boolean;
}

interface CheckinRecord {
  student_id: number;
  status: string;
}

// ==========================================
// Component: LecturerClassDetail
// ==========================================

export default function LecturerClassDetail() {
  const { class_id } = useParams<{ class_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation state restoration props
  const fromWeek = location.state?.fromWeek;
  const fromSemBreak = location.state?.fromSemBreak;
  const sessionDate = location.state?.sessionDate;

  // State Management
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineMode, setOnlineMode] = useState<boolean>(false);

  // Helper Booleans
  const now = new Date();
  const hasPreviousSession = session && new Date(session.started_at) < now;
  const isActiveSession = session && !session.is_expired && new Date(session.expires_at) > now;

  // ------------------------------------------
  // Navigation Handler
  // ------------------------------------------
  const handleBack = () => {
    navigate('/lecturer', {
      state: {
        restoreWeek: fromWeek,
        restoreSemBreak: fromSemBreak
      }
    });
  };

  // ------------------------------------------
  // Data Fetching
  // ------------------------------------------
  const fetchDetails = useCallback(async (forceIgnoreDate = false) => {
    if (!class_id) return;
    try {
      setLoading(true);

      const res = await axios.get(
        `http://localhost:3001/lecturer/class/${class_id}/details`,
        {
          params: { 
            week: fromWeek, 
            date: forceIgnoreDate ? undefined : (sessionDate ?? undefined)
          }
        }
      );

      setClassInfo(res.data.classInfo || null);

      const rawSession = res.data.session;
      setSession(
        rawSession
          ? {
              session_id: Number(rawSession.session_id),
              started_at: rawSession.started_at,
              expires_at: rawSession.expires_at,
              online_mode: !!rawSession.online_mode,
              is_expired: !!rawSession.is_expired,
            }
          : null
      );

      if (rawSession) {
        setOnlineMode(rawSession.online_mode === true);
      }

      // Map check-in statuses to students
      const checkins = res.data.checkins || [];
      const checkinMap = new Map<number, string>(
        checkins.map((c: CheckinRecord) => [c.student_id, c.status])
      );

      setStudents(
        (res.data.students || []).map((s: any) => {
          const checkinStatus = checkinMap.get(s.student_id);
          let status: "checked-in" | "missed" | "pending" = "pending";

          if (checkinStatus === "checked-in" || checkinStatus === "present") {
            status = "checked-in";
          } else if (checkinStatus === "missed" || (rawSession?.is_expired && !checkinStatus)) {
            status = "missed";
          }

          return {
            student_id: Number(s.student_id),
            name: s.name,
            email: s.email,
            status,
          };
        })
      );

    } catch (err) {
      console.error("Error fetching class details:", err);
    } finally {
      setLoading(false);
    }
  }, [class_id, sessionDate]);

  // Initial Fetch
  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // ------------------------------------------
  // Socket.IO Logic
  // ------------------------------------------
  useEffect(() => {
    if (!class_id) return;

    const id = Number(class_id);
    socket.emit("joinLecturerRoom", id);

    // Event: Session Expired
    const onSessionExpired = async (data: any) => {
      if (data.class_id !== id) return;
      console.log("🔴 Session expired for this class", data);

      setSession(null);
      setStudents((prev) =>
        prev.map((s) => ({
          ...s,
          status: s.status === "checked-in" ? "checked-in" : "missed"
        }))
      );

      try {
        await fetchDetails();
      } catch (e) { /* silent fail */ }
    };

    // Event: Student Checked In
    const onStudentCheckedIn = (data: any) => {
      if (data.class_id !== id) return;
      setStudents((prev) => 
        prev.map((s) => (s.student_id === data.student_id ? { ...s, status: "checked-in" } : s))
      );
    };

    // Event: Session Activated (e.g., from another tab)
    const onCheckinActivated = async (data: any) => {
      if (data.class_id !== id) return;
      console.log("🟡 Session activated:", data);

      setSession({
        session_id: data.session_id,
        started_at: data.startedAt,
        expires_at: data.expiresAt,
        online_mode: !!data.online_mode,
        is_expired: false,
      });

      await fetchDetails(true);
    };

    socket.on("sessionExpired", onSessionExpired);
    socket.on("studentCheckedIn", onStudentCheckedIn);
    socket.on("checkinActivated", onCheckinActivated);

    return () => {
      socket.off("sessionExpired", onSessionExpired);
      socket.off("studentCheckedIn", onStudentCheckedIn);
      socket.off("checkinActivated", onCheckinActivated);
      socket.emit("leaveLecturerRoom", id);
    };
  }, [class_id, fetchDetails]);

  // ------------------------------------------
  // Action Handlers
  // ------------------------------------------

  // Activate Check-in (Start Session)
  const handleActivateCheckIn = async () => {
    if (!class_id) return;
    try {
      const res = await axios.post(`http://localhost:3001/lecturer/class/${class_id}/activate-checkin`, {
        online_mode: onlineMode,
        custom_week: fromWeek
      });

      setSession({
        session_id: Number(res.data.session_id),
        started_at: res.data.started_at,
        expires_at: res.data.expires_at,
        online_mode: !!res.data.online_mode,
        is_expired: !!res.data.is_expired,
      });

      await fetchDetails(true);
    } catch (err) {
      console.error("Error activating check-in:", err);
    }
  };

  // Manual Check-in (Lecturer overrides status)
  const handleManualCheckIn = async (studentId: number) => {
    if (!session) return;
    try {
      await axios.post(`http://localhost:3001/lecturer/session/${session.session_id}/manual-checkin`, {
        student_id: studentId
      });

      setStudents(prev =>
        prev.map(s =>
          s.student_id === studentId
            ? { ...s, status: "checked-in" }
            : s
        )
      );

    } catch (err) {
      console.error("Manual check-in failed:", err);
    }
  };

  // ------------------------------------------
  // Main Render
  // ------------------------------------------

  if (loading) return <p className="text-white p-8">Loading...</p>;

  return (
    <div className="min-h-screen text-white p-8 bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923]">
      
      {/* Back Button */}
      <button onClick={handleBack} className="mb-4 px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">
        ← Back
      </button>

      {/* --- Class Details & Controls --- */}
      <div className="bg-[#181818]/80 p-6 rounded-2xl border border-white/10 mb-6">
        <h1 className="text-2xl font-bold mb-2">{classInfo?.class_name}</h1>
        <p>Course Code: {classInfo?.course_code}</p>
        <p>Day: {classInfo?.day_of_week}</p>
        <p>Date: {sessionDate ? new Date(sessionDate).toLocaleDateString() : "—"}</p>
        <p>
          Time: {classInfo?.start_time} - {classInfo?.end_time} ({classInfo?.class_type})
        </p>
        <p>Lecturer: {classInfo?.lecturer_name}</p>

        {/* Online Mode Toggle */}
        <div className="flex items-center gap-3 mt-3">
          <label className="font-semibold">Online Mode</label>
          <input 
            type="checkbox" 
            checked={onlineMode} 
            onChange={(e) => setOnlineMode(e.target.checked)} 
          />
          <span className="text-sm text-gray-400">
            {onlineMode ? "Geolocation disabled" : "Geolocation required"}
          </span>
        </div>

        {/* Session Status Section */}
        <div className="mt-4">
          {/* Active Session Status */}
          {isActiveSession && (
            <p className="text-yellow-400 font-semibold">
              🟡 Active until {new Date(session!.expires_at).toLocaleTimeString()} 
              <br />
              Attendance: {students.filter(s => s.status === "checked-in").length} / {students.length}
            </p>
          )}

          {/* Past Session Status */}
          {!isActiveSession && hasPreviousSession && (
            <div className="text-blue-400 font-semibold">
              🔵 Previously Activated
              <br />
              Last session: {new Date(session!.started_at).toLocaleString()}
            </div>
          )}

          {/* Activate Button (Only if no session exists) */}
          {!isActiveSession && !hasPreviousSession && (
            <button
              onClick={handleActivateCheckIn}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-500"
            >
              Activate Check-in
            </button>
          )}
        </div>
      </div>

      {/* --- Student List --- */}
      <div className="bg-[#1a1a1f]/80 p-4 rounded-2xl border border-white/10">
        <h2 className="text-xl font-semibold mb-4">Students</h2>
        {students.length === 0 ? (
          <p>No students enrolled.</p>
        ) : (
          <>
            {/* 1. Checked In Students */}
            {students
              .filter(s => s.status === "checked-in")
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(s => (
                <div key={s.student_id} className="flex justify-between px-4 py-2 bg-[#22222a] rounded-md mb-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-gray-400">{s.email}</p>
                  </div>
                  <span className="text-green-400 font-semibold">🟢 Checked in</span>
                </div>
              ))}

            {/* 2. Pending Students */}
            {students
              .filter(s => s.status === "pending")
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(s => (
                <div key={s.student_id} className="flex justify-between px-4 py-2 bg-[#22222a] rounded-md mb-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-gray-400">{s.email}</p>
                  </div>
                  <button
                    className="text-green-400 font-bold hover:text-green-300"
                    onClick={() => handleManualCheckIn(s.student_id)}
                  >
                    ✔
                  </button>
                </div>
              ))}

            {/* 3. Missed Students */}
            {students
              .filter(s => s.status === "missed")
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(s => (
                <div key={s.student_id} className="flex justify-between px-4 py-2 bg-[#22222a] rounded-md mb-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-gray-400">{s.email}</p>
                  </div>
                  <span className="text-red-500 font-semibold">🔴 Missed</span>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}