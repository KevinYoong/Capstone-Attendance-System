import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import socket from "../utils/socket";

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
}

export default function LecturerClassDetail() {
  const { class_id } = useParams<{ class_id: string }>();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    if (!class_id) return;
    try {
    setLoading(true);
    const res = await axios.get(`/lecturer/class/${class_id}/details`);

    // backend shape: { classInfo, students, session, checkins }
    setClassInfo(res.data.classInfo || null);

    setSession(res.data.session || null);

    const checkins = res.data.checkins || [];
    const checkinMap = new Map(checkins.map((c: any) => [c.student_id, c.status]));

    setStudents(
    (res.data.students || []).map((s: any) => ({
    student_id: Number(s.student_id),
    name: s.name,
    email: s.email,
    status: checkinMap.has(s.student_id) ? "checked-in" : "pending",
    }))
    );
    } catch (err) {
    console.error("Error fetching class details:", err);
    } finally {
    setLoading(false);
    }
  }, [class_id]);

  // initial fetch
  useEffect(() => {
  fetchDetails();
  }, [fetchDetails]);

  // Join lecturer room and listen for session events
  useEffect(() => {
    if (!class_id) return;

    const id = Number(class_id);
    socket.emit("joinLecturerRoom", id);

    const onSessionExpired = async (data: any) => {
      if (data.class_id !== id) return;
      console.log("🔴 Session expired for this class", data);

      // Optimistically set session null and mark pending->missed
      setSession(null);
      setStudents((prev) =>
        prev.map((s) => ({
          ...s,
          status: s.status === "checked-in" ? "checked-in" : "missed"
        }))
      );

      // Refresh details from backend to ensure authoritative state
      try {
      await fetchDetails();
      } catch (e) {
      // swallow - fetchDetails already logs
      }
    };

    const onStudentCheckedIn = (data: any) => {
      if (data.class_id !== id) return;
      setStudents((prev) => prev.map((s) => (s.student_id === data.student_id ? { ...s, status: "checked-in" } : s)));
    };

    socket.on("sessionExpired", onSessionExpired);
    socket.on("studentCheckedIn", onStudentCheckedIn);

    return () => {
      socket.off("sessionExpired", onSessionExpired);
      socket.off("studentCheckedIn", onStudentCheckedIn);
      socket.emit("leaveLecturerRoom", id);
    };
  }, [class_id, fetchDetails]);

  const handleActivateCheckIn = async () => {
    if (!class_id) return;
    try {
    const res = await axios.post(`/lecturer/class/${class_id}/activate-checkin`);

    setSession({
    session_id: res.data.session_id,
    started_at: res.data.started_at,
    expires_at: res.data.expires_at,
    });

    // Immediately refresh to ensure checkins and students reflect latest state
    await fetchDetails();
    } catch (err) {
    console.error("Error activating check-in:", err);
    }
  };

  const statusBadge = (status?: string) => {
    switch (status) {
      case "checked-in":
        return <span className="text-green-400 font-semibold">🟢 Checked in</span>;
      case "missed":
        return <span className="text-red-500 font-semibold">🔴 Missed</span>;
      default:
        return <span className="text-gray-400 font-semibold">⚪ Pending</span>;
    }
  };

  if (loading) return <p className="text-white p-8">Loading...</p>;

  return (
    <div className="min-h-screen text-white p-8">
      <button onClick={() => navigate(-1)} className="mb-4 px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">
        ← Back
      </button>

      <div className="bg-[#181818]/80 p-6 rounded-2xl border border-white/10 mb-6">
        <h1 className="text-2xl font-bold mb-2">{classInfo?.class_name}</h1>
        <p>Course Code: {classInfo?.course_code}</p>
        <p>Day: {classInfo?.day_of_week}</p>
        <p>
          Time: {classInfo?.start_time} - {classInfo?.end_time} ({classInfo?.class_type})
        </p>
        <p>Lecturer: {classInfo?.lecturer_name}</p>


        <div className="mt-4">
         {session ? (
          <p className="text-yellow-400 font-semibold">🟡 Check-in active until {new Date(session.expires_at).toLocaleTimeString()}</p>
          ) : (
          <button onClick={handleActivateCheckIn} className="px-4 py-2 bg-green-600 rounded hover:bg-green-500">
          Activate Check-in
          </button>
          )}
        </div>
      </div>

      <div className="bg-[#1a1a1f]/80 p-4 rounded-2xl border border-white/10">
        <h2 className="text-xl font-semibold mb-4">Students</h2>
        {students.length === 0 ? (
          <p>No students enrolled.</p>
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <div key={s.student_id} className="flex justify-between px-4 py-2 bg-[#22222a] rounded-md">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-gray-400">{s.email}</p>
                </div>
                <div>
                  {s.status === "checked-in" ? (
                    <span className="text-green-400 font-semibold">🟢 Checked in</span>
                  ) : s.status === "missed" ? (
                    <span className="text-red-500 font-semibold">🔴 Missed</span>
                  ) : (
                    <span className="text-gray-400 font-semibold">⚪ Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}