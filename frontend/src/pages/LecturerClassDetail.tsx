import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

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
  const { class_id } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3001/lecturer/class/${class_id}/details`
        );
        setClassInfo(res.data.classInfo);
        setSession(res.data.latestSession);
        setStudents(res.data.students.map((s: any) => ({
          ...s,
          status: "pending", // for now everyone is pending
        })));
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [class_id]);

  const handleActivateCheckIn = async () => {
    try {
      const res = await axios.post(
        `http://localhost:3001/lecturer/class/${class_id}/activate-checkin`
      );

      // Update session in frontend
      setSession({
        session_id: res.data.sessionId,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // Refresh student list (optional)
      const studentsRes = await axios.get(
        `http://localhost:3001/lecturer/class/${class_id}/details`
      );
      setStudents(studentsRes.data.students.map((s: any) => ({
        ...s,
        status: "pending",
      })));
    } catch (err) {
      console.error(err);
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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition"
      >
        ← Back
      </button>

      <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6">
        <h1 className="text-2xl font-bold mb-2">{classInfo?.class_name}</h1>
        <p>Course Code: {classInfo?.course_code}</p>
        <p>Day: {classInfo?.day_of_week}</p>
        <p>
          Time: {classInfo?.start_time} - {classInfo?.end_time} ({classInfo?.class_type})
        </p>
        <p>Lecturer: {classInfo?.lecturer_name}</p>

        <div className="mt-4">
          {session ? (
            <p className="text-yellow-400 font-semibold">
              🟡 Check-in active until {new Date(session.expires_at).toLocaleTimeString()}
            </p>
          ) : (
            <button
              onClick={handleActivateCheckIn}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 transition mt-2"
            >
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
              <div
                key={s.student_id}
                className="flex justify-between px-4 py-2 bg-[#22222a] rounded-md"
              >
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-gray-400">{s.email}</p>
                </div>
                <div>{statusBadge(s.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}