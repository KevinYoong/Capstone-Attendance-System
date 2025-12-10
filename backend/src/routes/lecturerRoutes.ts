import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";

const router = Router();

// ----- TYPES -----
interface ClassRow extends RowDataPacket {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  start_time: string;
  end_time: string;
  class_type: "Lecture" | "Tutorial";
}

interface StudentRow extends RowDataPacket {
  student_id: number;
  name: string;
  email: string;
}

interface CheckinRow extends RowDataPacket {
  checkin_id: number;
  student_id: number;
  code_id: number;
  checkin_time: Date;
  status: string;
}

interface SessionRow extends RowDataPacket {
  session_id: number;
  class_id: number;
  started_at: Date;
  expires_at: Date;
  online_mode: boolean;
}

interface SemesterRow extends RowDataPacket {
  start_date: string;
  end_date?: string;
}

function getAcademicWeek(startDate: Date, targetDate: Date): number {
  const diff = targetDate.getTime() - startDate.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// ----- ROUTES -----

// Get weekly schedule for a lecturer
router.get("/:lecturer_id/classes/week", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;
  const selectedWeek = req.query.week;

  if (selectedWeek === "break") {
    return res.json({
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: []
    });
  }

  try {
    // Note: week parameter accepted but not used for filtering since all classes are standard (1-14)
    // Can be used in future for classes with specific start_week/end_week
    const [rows] = await db.query<ClassRow[]>(
      `
      SELECT * FROM Class
      WHERE lecturer_id = ?
      ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time
      `,
      [lecturer_id]
    );

    const week: Record<string, ClassRow[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };

    rows.forEach(cls => {
      week[cls.day_of_week].push(cls);
    });

    res.json(week);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving classes" });
  }
});

router.get("/class/:class_id/active-session", async (req: Request, res: Response) => {
  const { class_id } = req.params;

  try {
    // Find the active (not expired) session for this class (if exists)
    const [activeRows] = await db.query<any[]>(
      `
      SELECT session_id, class_id, started_at, 
        DATE(started_at) AS started_date,
        expires_at, online_mode, is_expired, week_number
      FROM Session
      WHERE class_id = ?
        AND (is_expired = 0 OR is_expired IS NULL)
        AND expires_at > NOW()
      ORDER BY started_at DESC
      LIMIT 1
      `,
      [class_id]
    );

    if (activeRows.length === 0) {
      return res.json({ success: true, session: null, checkins: [] });
    }

    const session = activeRows[0];

    // Fetch checkins for this session with student info
    const [checkinRows] = await db.query<any[]>(
      `
      SELECT ci.checkin_id, ci.session_id, ci.student_id, ci.checkin_time, ci.status,
             s.name AS student_name, s.email AS student_email
      FROM Checkin ci
      JOIN Student s ON s.student_id = ci.student_id
      WHERE ci.session_id = ?
      ORDER BY ci.checkin_time ASC
      `,
      [session.session_id]
    );

    return res.json({
      success: true,
      session: {
        session_id: session.session_id,
        class_id: session.class_id,
        started_at: session.started_at,
        started_date: session.started_date ? session.started_date : (new Date(session.started_at)).toISOString().split('T')[0],
        expires_at: session.expires_at,
        online_mode: !!session.online_mode,
        is_expired: !!session.is_expired,
        week_number: session.week_number ?? null
      },
      checkins: checkinRows
    });
  } catch (err) {
    console.error("Error fetching active session:", err);
    return res.status(500).json({ success: false, message: "Error fetching active session" });
  }
});

router.get("/:lecturer_id/attendance/semester", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;

  try {
    // 1) Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );

    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester found" });
    }
    const semester = semRows[0];

    // 2) Get classes for this lecturer (that fall within semester is not necessary here because classes are tied to semester in schema)
    const [classRows] = await db.query<any[]>(
      `
      SELECT class_id, class_name, course_code
      FROM Class
      WHERE lecturer_id = ?
      ORDER BY class_name
      `,
      [lecturer_id]
    );

    // 3) For each class, fetch sessions in semester range and their checkins
    const classesWithSessions: any[] = [];

    for (const c of classRows) {
      const [sessions] = await db.query<any[]>(
        `
        SELECT s.session_id, s.class_id, s.started_at, DATE(s.started_at) AS started_date, s.expires_at, s.online_mode, s.is_expired, s.week_number
        FROM Session s
        WHERE s.class_id = ?
          AND s.started_at BETWEEN ? AND ?
        ORDER BY s.started_at ASC
        `,
        [c.class_id, semester.start_date, semester.end_date]
      );

      // For each session, gather checkins
      const sessionsWithCheckins = [];
      for (const s of sessions) {
        const [checkins] = await db.query<any[]>(
          `
          SELECT ci.checkin_id, ci.session_id, ci.student_id, ci.checkin_time, ci.status,
                 st.name AS student_name, st.email AS student_email
          FROM Checkin ci
          JOIN Student st ON st.student_id = ci.student_id
          WHERE ci.session_id = ?
          ORDER BY ci.checkin_time ASC
          `,
          [s.session_id]
        );

        sessionsWithCheckins.push({
          session_id: s.session_id,
          started_at: s.started_at,
          started_date: s.started_date ? s.started_date : (new Date(s.started_at)).toISOString().split('T')[0],
          week_number: s.week_number ?? null,
          expires_at: s.expires_at,
          online_mode: !!s.online_mode,
          is_expired: !!s.is_expired,
          checkins: checkins
        });
      }

      classesWithSessions.push({
        class_id: c.class_id,
        class_name: c.class_name,
        course_code: c.course_code,
        sessions: sessionsWithCheckins
      });
    }

    return res.json({
      success: true,
      semester,
      classes: classesWithSessions
    });
  } catch (err) {
    console.error("Error fetching lecturer semester attendance:", err);
    return res.status(500).json({ success: false, message: "Error fetching attendance" });
  }
});

// Get detailed class info
router.get("/class/:class_id/details", async (req: Request, res: Response) => {
  const { class_id } = req.params;
  const selectedDate = req.query.date as string | undefined;

  try {
    const [classRows] = await db.query<ClassRow[]>(
      `SELECT 
        c.*, 
        l.name AS lecturer_name
      FROM Class c
      JOIN Lecturer l ON c.lecturer_id = l.lecturer_id
      WHERE c.class_id = ?`,
      [class_id]
    );
    const classInfo = classRows[0];
    if (!classInfo) return res.status(404).json({ message: "Class not found" });

    const [studentRows] = await db.query<StudentRow[]>(
      `
      SELECT Student.student_id, Student.name, Student.email
      FROM StudentClass
      JOIN Student ON StudentClass.student_id = Student.student_id
      WHERE StudentClass.class_id = ?
      `,
      [class_id]
    );

    // If frontend gives us a date → fetch session for EXACT date
    let session: SessionRow | null = null;
    let checkins: CheckinRow[] = [];

    if (selectedDate) {
      const [sessionRows] = await db.query<SessionRow[]>(
        `
        SELECT *
        FROM Session
        WHERE class_id = ?
          AND DATE(started_at) = ?
        LIMIT 1
        `,
        [class_id, selectedDate]
      );

      session = sessionRows.length > 0 ? sessionRows[0] : null;

      if (session) {
        const [checkinRows] = await db.query<CheckinRow[]>(
          `SELECT * FROM Checkin WHERE session_id = ?`,
          [session.session_id]
        );
        checkins = checkinRows;
      }
    } else {
      // Fallback: get latest session in semester if no date provided
      const [semesterRows] = await db.query<any[]>(
        `SELECT start_date, end_date FROM Semester WHERE status='active' LIMIT 1`
      );
      const semester = semesterRows[0];

      const [sessionRows] = await db.query<SessionRow[]>(
        `
        SELECT *
        FROM Session
        WHERE class_id = ?
          AND started_at BETWEEN ? AND ?
        ORDER BY started_at DESC
        LIMIT 1
        `,
        [class_id, semester.start_date, semester.end_date]
      );

      session = sessionRows.length > 0 ? sessionRows[0] : null;

      if (session) {
        const [checkinRows] = await db.query<CheckinRow[]>(
          `SELECT * FROM Checkin WHERE session_id = ?`,
          [session.session_id]
        );
        checkins = checkinRows;
      }
    }

    return res.json({
      classInfo,
      students: studentRows,
      session,
      checkins
    });
  } catch (err) {
    console.error("Error retrieving class details:", err);
    return res.status(500).json({ message: "Error retrieving class details" });
  }
});

// Activate check-in for a class
router.post("/class/:class_id/activate-checkin", async (req: Request, res: Response) => {
  const { class_id } = req.params;

  let conn: any = null;
  try {
    conn = await (db as any).getConnection();
    await conn.beginTransaction();

    // 1) Optional: mark any already expired sessions as is_expired = 1 (safety)
    await conn.query(
      `UPDATE Session SET is_expired = 1 WHERE class_id = ? AND expires_at < NOW() AND is_expired = 0`,
      [class_id]
    );

    // 2) Check if there is an active session that hasn't expired (avoid duplicates)
    const [semesterRows] = await conn.query(
      `SELECT start_date, end_date FROM Semester WHERE status='active' LIMIT 1`
    );

    const semester = semesterRows[0];

    const [activeRows] = await conn.query(
      `SELECT session_id, started_at, expires_at, online_mode
      FROM Session
      WHERE class_id = ?
        AND is_expired = 0
        AND expires_at > NOW()
        AND started_at BETWEEN ? AND ?
      ORDER BY started_at DESC LIMIT 1`,
      [class_id, semester.start_date, semester.end_date]
    );

    if (activeRows.length > 0) {
      // There's an active session — return it instead of creating a new one
      const active = activeRows[0];
      await conn.rollback();
      conn.release();
      return res.status(200).json({
        message: "An active check-in already exists",
        session_id: active.session_id,
        started_at: active.started_at,
        expires_at: active.expires_at,
        online_mode: active.online_mode === 1
      });
    }

    // 3) Create new session
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 2 * 60000); 
    // Load semester start date
    const [semRows] = await db.query<SemesterRow[]>(
      `SELECT start_date FROM Semester WHERE status='active' LIMIT 1`
    );
    const semesterStart = new Date(semRows[0].start_date);
    const weekNumber = getAcademicWeek(semesterStart, startedAt);
    const { online_mode } = req.body;
    const isOnlineMode: boolean = online_mode === true;

    const [result] = await conn.query(
      `INSERT INTO Session (class_id, started_at, expires_at, online_mode, is_expired, week_number)
      VALUES (?, ?, ?, ?, 0, ?)`,
      [class_id, startedAt, expiresAt, isOnlineMode ? 1 : 0, weekNumber]
    );

    const session_id = (result as any).insertId;

    await conn.commit();
    conn.release();

    // Emit to this class room only
    io.to(`class_${class_id}`).emit("checkinActivated", {
      class_id: Number(class_id),
      session_id,
      startedAt: startedAt.toISOString(),
      started_date: semesterStart ? startedAt.toISOString().split('T')[0] : startedAt.toISOString().split('T')[0],
      expiresAt: expiresAt.toISOString(),
      online_mode: isOnlineMode,
      week_number: weekNumber
    });

    return res.status(201).json({
      message: "Check-in activated",
      session_id,
      started_at: startedAt,
      started_date: startedAt.toISOString().split('T')[0],
      expires_at: expiresAt,
      online_mode: isOnlineMode,
      week_number: weekNumber
    });
  } catch (err) {
    console.error("Error activating check-in:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
      try { conn.release(); } catch (e) {}
    }
    return res.status(500).json({ message: "Error activating check-in" });
  }
});

// Manually checking in a student
router.post("/session/:session_id/manual-checkin", async (req: Request, res: Response) => {
  const { session_id } = req.params;
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ success: false, message: "student_id is required" });
  }

  try {
    // 1) Validate session exists
    const [sessionRows] = await db.query<any[]>(
      `SELECT session_id, class_id, expires_at, online_mode, is_expired, week_number
       FROM Session 
       WHERE session_id = ?`,
      [session_id]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const session = sessionRows[0];

    // 2) Check if session is expired
    const now = new Date();
    if (session.is_expired === 1 || new Date(session.expires_at) < now) {
      return res.status(400).json({ success: false, message: "Session already expired" });
    }

    // 3) Prevent duplicate check-ins
    const [existing] = await db.query<any[]>(
      `SELECT checkin_id 
       FROM Checkin 
       WHERE session_id = ? AND student_id = ?`,
      [session_id, student_id]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Student already checked in",
        alreadyCheckedIn: true
      });
    }

    // 4) Insert manual check-in
    await db.query(
      `INSERT INTO Checkin (session_id, student_id, checkin_time, status)
       VALUES (?, ?, NOW(), 'checked-in')`,
      [session_id, student_id]
    );

    // 5) Emit to lecturer & students watching the class
    io.to(`class_${session.class_id}`).emit("studentCheckedIn", {
      class_id: session.class_id,
      student_id,
      session_id,
      manual: true
    });

    return res.json({
      success: true,
      message: "Manual check-in successful",
      student_id,
      session_id
    });

  } catch (err) {
    console.error("Manual check-in error:", err);
    return res.status(500).json({ success: false, message: "Server error during manual check-in" });
  }
});

// Lecturer analytics endpoint (Semester overview)
router.get("/:lecturer_id/analytics", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;

  try {
    // 1. Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status='active' LIMIT 1`
    );

    if (semRows.length === 0)
      return res.status(404).json({ success: false, message: "No active semester" });

    const semester = semRows[0];

    // 2. Fetch all classes for this lecturer
    const [classRows] = await db.query<any[]>(
      `
      SELECT class_id, class_name, course_code
      FROM Class
      WHERE lecturer_id = ?
      ORDER BY class_name
      `,
      [lecturer_id]
    );

    const results: any[] = [];

    for (const cls of classRows) {
      // 3. Get all sessions within semester
      const [sessions] = await db.query<any[]>(
        `
        SELECT session_id
        FROM Session
        WHERE class_id = ?
          AND started_at BETWEEN ? AND ?
        `,
        [cls.class_id, semester.start_date, semester.end_date]
      );

      let presentCount = 0;
      let missedCount = 0;

      for (const sess of sessions) {
        const [presentRows] = await db.query<any[]>(
          `SELECT COUNT(*) AS count FROM Checkin WHERE session_id = ?`,
          [sess.session_id]
        );

        const present = presentRows[0].count;

        // Count all enrolled students
        const [totalRows] = await db.query<any[]>(
          `SELECT COUNT(*) AS count FROM StudentClass WHERE class_id = ?`,
          [cls.class_id]
        );

        const total = totalRows[0].count;
        const missed = total - present;

        presentCount += present;
        missedCount += missed;
      }

      const totalSessions = sessions.length;
      const attendanceRate =
        totalSessions === 0 ? 0 : Math.round((presentCount / (presentCount + missedCount)) * 100);

      let status: "good" | "warning" | "critical";
      if (attendanceRate >= 90) status = "good";
      else if (attendanceRate >= 80) status = "warning";
      else status = "critical";

      results.push({
        class_id: cls.class_id,
        class_name: cls.class_name,
        course_code: cls.course_code,
        total_sessions: totalSessions,
        present_count: presentCount,
        missed_count: missedCount,
        attendance_rate: attendanceRate,
        attendance_status: status
      });
    }

    return res.json({
      success: true,
      semester,
      classes: results
    });

  } catch (err) {
    console.error("Lecturer analytics error:", err);
    return res.status(500).json({ success: false, message: "Error loading analytics" });
  }
});

// Lecturer analytics endpoint (Per-class detailed)
router.get("/:lecturer_id/analytics/class/:class_id", async (req: Request, res: Response) => {
  const { class_id } = req.params;

  try {
    // 1. Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status='active' LIMIT 1`
    );
    if (semRows.length === 0)
      return res.status(404).json({ success: false, message: "No active semester found" });

    const semester = semRows[0];

    // 2. Get all students enrolled in this class
    const [studentRows] = await db.query<any[]>(
      `
      SELECT s.student_id, s.name, s.email
      FROM StudentClass sc
      JOIN Student s ON s.student_id = sc.student_id
      WHERE sc.class_id = ?
      ORDER BY s.name
      `,
      [class_id]
    );

    // 3. Get all sessions
    const [sessions] = await db.query<any[]>(
      `
      SELECT session_id, started_at, expires_at, online_mode, is_expired
      FROM Session
      WHERE class_id = ?
        AND started_at BETWEEN ? AND ?
      ORDER BY started_at ASC
      `,
      [class_id, semester.start_date, semester.end_date]
    );

    const sessionDetails: any[] = [];
    const studentMap: Record<number, any> = {};

    studentRows.forEach((st) => {
      studentMap[st.student_id] = {
        student_id: st.student_id,
        name: st.name,
        email: st.email,
        present_count: 0,
        missed_count: 0,
      };
    });

    // Count per session + update student totals
    for (const sess of sessions) {
      const [presentRows] = await db.query<any[]>(
        `SELECT student_id FROM Checkin WHERE session_id = ?`,
        [sess.session_id]
      );

      const presentList = presentRows.map((r) => r.student_id);
      const presentCount = presentList.length;
      const total = studentRows.length;
      const missedCount = total - presentCount;

      // Update student aggregates
      studentRows.forEach((st) => {
        if (presentList.includes(st.student_id)) {
          studentMap[st.student_id].present_count++;
        } else {
          studentMap[st.student_id].missed_count++;
        }
      });

      sessionDetails.push({
        session_id: sess.session_id,
        date: sess.started_at,
        present_count: presentCount,
        missed_count: missedCount,
        attendance_rate: total === 0 ? 0 : Math.round((presentCount / total) * 100),
        online_mode: !!sess.online_mode
      });
    }

    // Build student list with rates
    const studentList = Object.values(studentMap).map((s: any) => {
      const total = s.present_count + s.missed_count;
      const rate = total === 0 ? 0 : Math.round((s.present_count / total) * 100);

      let status: "good" | "warning" | "critical";
      if (rate >= 90) status = "good";
      else if (rate >= 80) status = "warning";
      else status = "critical";

      return { ...s, attendance_rate: rate, attendance_status: status };
    });

    // Sort least-attending students
    const leastAttending = [...studentList].sort(
      (a, b) => a.attendance_rate - b.attendance_rate
    );

    return res.json({
      success: true,
      summary: {
        total_sessions: sessions.length,
        present_total: studentList.reduce((a, s) => a + s.present_count, 0),
        missed_total: studentList.reduce((a, s) => a + s.missed_count, 0),
      },
      students: studentList,
      sessions: sessionDetails,
      least_attending: leastAttending.slice(0, 5)
    });

  } catch (err) {
    console.error("Class analytics error:", err);
    return res.status(500).json({ success: false, message: "Error loading class analytics" });
  }
});

// Export class analytics as CSV
router.get("/:lecturer_id/analytics/class/:class_id/export.csv", async (req: Request, res: Response) => {
  const { class_id } = req.params;
  const type = (req.query.type as string) || "students";

  try {
    // (Reuse analytics logic here)
    const [studentRows] = await db.query<any[]>(
      `SELECT s.student_id, s.name, s.email
       FROM StudentClass sc
       JOIN Student s ON s.student_id = sc.student_id
       WHERE sc.class_id = ?
       ORDER BY s.name`,
      [class_id]
    );

    const [sessions] = await db.query<any[]>(
      `SELECT session_id, started_at
       FROM Session
       WHERE class_id = ?
       ORDER BY started_at ASC`,
      [class_id]
    );

    if (type === "students") {
      // Build student summary CSV
      let csv = "student_id,name,email,present_count,missed_count,attendance_rate,status\n";

      for (const st of studentRows) {
        const [presentRows] = await db.query<any[]>(
          `SELECT COUNT(*) AS count
           FROM Checkin
           WHERE student_id = ? AND session_id IN (
             SELECT session_id FROM Session WHERE class_id = ?
           )`,
          [st.student_id, class_id]
        );

        const present = presentRows[0].count;
        const missed = sessions.length - present;
        const rate = sessions.length === 0 ? 0 : Math.round((present / sessions.length) * 100);

        const status = rate >= 90 ? "good" : rate >= 80 ? "warning" : "critical";

        csv += `${st.student_id},${st.name},${st.email},${present},${missed},${rate},${status}\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      return res.send(csv);
    }

    // type = sessions
    let csv = "session_id,date,present_count,missed_count,attendance_rate\n";

    for (const sess of sessions) {
      const [presentRows] = await db.query<any[]>(
        `SELECT COUNT(*) AS count FROM Checkin WHERE session_id = ?`,
        [sess.session_id]
      );

      const present = presentRows[0].count;
      const total = studentRows.length;
      const missed = total - present;
      const rate = total === 0 ? 0 : Math.round((present / total) * 100);

      csv += `${sess.session_id},${sess.started_at},${present},${missed},${rate}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    return res.send(csv);

  } catch (err) {
    console.error("CSV export error:", err);
    return res.status(500).json({ success: false, message: "CSV export failed" });
  }
});

export default router;