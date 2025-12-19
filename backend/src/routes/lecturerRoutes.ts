import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";

const router = Router();

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

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

/**
 * Calculates the current academic week number based on the semester start date.
 */
function getAcademicWeek(startDate: Date, targetDate: Date): number {
  const diff = targetDate.getTime() - startDate.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// ============================================================================
//                            SCHEDULE & DASHBOARD
// ============================================================================

/**
 * GET /:lecturer_id/classes/week
 * Retrieves the weekly schedule for a lecturer, organized by day of the week.
 * @query week - Optional week number (or "break") to filter logic if needed.
 */
router.get("/:lecturer_id/classes/week", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;
  const selectedWeek = req.query.week;

  if (selectedWeek === "break") {
    return res.json({
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
    });
  }

  try {
    const [rows] = await db.query<ClassRow[]>(
      `
      SELECT * FROM Class
      WHERE lecturer_id = ?
      ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time
      `,
      [lecturer_id]
    );

    const week: Record<string, ClassRow[]> = {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [],
    };

    rows.forEach(cls => {
      if (week[cls.day_of_week]) {
        week[cls.day_of_week].push(cls);
      }
    });

    res.json(week);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving classes" });
  }
});

/**
 * GET /class/:class_id/active-session
 * Checks if a class currently has an active, non-expired check-in session.
 */
router.get("/class/:class_id/active-session", async (req: Request, res: Response) => {
  const { class_id } = req.params;

  try {
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

    // Fetch students already checked in
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
        scheduled_date: session.scheduled_date,
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

/**
 * GET /:lecturer_id/attendance/semester
 * Returns a high-level overview of attendance for all classes in the active semester.
 */
router.get("/:lecturer_id/attendance/semester", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );

    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester found" });
    }
    const semester = semRows[0];

    const [classRows] = await db.query<any[]>(
      `
      SELECT class_id, class_name, course_code
      FROM Class
      WHERE lecturer_id = ?
      ORDER BY class_name
      `,
      [lecturer_id]
    );

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

// ============================================================================
//                            CLASS DETAILS & ACTIONS
// ============================================================================

/**
 * GET /class/:class_id/details
 * Retrieves detailed info for a specific class (Lecturer View).
 * * IMPORTANT: This endpoint uses 'scheduled_date' to find sessions.
 * This fixes timezone mismatches between the frontend (Local) and backend (UTC).
 */
router.get("/class/:class_id/details", async (req: Request, res: Response) => {
  const { class_id } = req.params;
  const selectedDate = req.query.date as string | undefined;

  try {
    const [classRows] = await db.query<ClassRow[]>(
      `SELECT c.*, l.name AS lecturer_name
      FROM Class c
      JOIN Lecturer l ON c.lecturer_id = l.lecturer_id
      WHERE c.class_id = ?`,
      [class_id]
    );
    const classInfo = classRows[0];
    if (!classInfo) return res.status(404).json({ message: "Class not found" });

    // Fetch all enrolled students
    const [studentRows] = await db.query<StudentRow[]>(
      `
      SELECT Student.student_id, Student.name, Student.email
      FROM StudentClass
      JOIN Student ON StudentClass.student_id = Student.student_id
      WHERE StudentClass.class_id = ?
      `,
      [class_id]
    );

    let session: SessionRow | null = null;
    let checkins: CheckinRow[] = [];

    if (selectedDate) {
      // Check against scheduled_date OR date(started_at)
      const [sessionRows] = await db.query<SessionRow[]>(
        `
        SELECT *
        FROM Session
        WHERE class_id = ?
          AND (scheduled_date = ? OR DATE(started_at) = ?)
        LIMIT 1
        `,
        [class_id, selectedDate, selectedDate]
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
      // Fallback: Get the most recent session if no date provided
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

/**
 * POST /class/:class_id/activate-checkin
 * Starts a new attendance session for the class.
 * - Marks previous active sessions as expired.
 * - Calculates the correct 'scheduled_date' based on academic week.
 * - Emits a Socket.IO event to notify students instantly.
 */
router.post("/class/:class_id/activate-checkin", async (req: Request, res: Response) => {
  const { class_id } = req.params;

  let conn: any = null;
  try {
    conn = await (db as any).getConnection();
    await conn.beginTransaction();

    // 1. Expire any old pending sessions
    await conn.query(
      `UPDATE Session SET is_expired = 1 WHERE class_id = ? AND expires_at < NOW() AND is_expired = 0`,
      [class_id]
    );

    const [semesterRows] = await conn.query(
      `SELECT start_date, end_date FROM Semester WHERE status='active' LIMIT 1`
    );
    const semester = semesterRows[0];

    // 2. Prevent double activation
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

    // 3. Create new Session
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 30 * 60000); // 30 minutes duration

    console.log("⏱️ [Activate] Server Time:", startedAt);
    console.log("⏱️ [Activate] Expires At:", expiresAt);

    // Calculate Week Number & Scheduled Date
    const [semRows] = await db.query<SemesterRow[]>(
      `SELECT start_date FROM Semester WHERE status='active' LIMIT 1`
    );
    const semesterStart = new Date(semRows[0].start_date);
    const weekNumber = getAcademicWeek(semesterStart, startedAt);
    
    const [classRows] = await conn.query(
      `SELECT day_of_week, start_time FROM Class WHERE class_id = ?`,
      [class_id]
    );
    const cls = classRows[0];

    const dayIndexMap = {
      Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4,
    } as const;
    const dayIndex = dayIndexMap[cls.day_of_week as keyof typeof dayIndexMap];

    const scheduled = new Date(semesterStart);
    scheduled.setDate(semesterStart.getDate() + (weekNumber - 1) * 7 + dayIndex);
    const scheduled_date = scheduled.toLocaleDateString('en-CA'); // YYYY-MM-DD format

    const { online_mode } = req.body;
    const isOnlineMode: boolean = online_mode === true;

    const [result] = await conn.query(
      `INSERT INTO Session (class_id, started_at, scheduled_date, expires_at, online_mode, is_expired, week_number)
      VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [class_id, startedAt, scheduled_date, expiresAt, isOnlineMode ? 1 : 0, weekNumber]
    );

    const session_id = (result as any).insertId;

    await conn.commit();
    conn.release();

    // 4. Notify Students via Socket.IO
    console.log(`🚀 [Activate] Emitting Socket to room: class_${class_id}`);

    io.to(`class_${class_id}`).emit("checkinActivated", {
      class_id: Number(class_id),
      session_id,
      startedAt: startedAt.toISOString(),
      started_date: scheduled_date,   
      scheduled_date: scheduled_date, 
      expiresAt: expiresAt.toISOString(),
      online_mode: isOnlineMode,
      week_number: weekNumber
    });

    return res.status(201).json({
      message: "Check-in activated",
      session_id,
      started_at: startedAt,
      scheduled_date: scheduled_date,
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

/**
 * POST /session/:session_id/manual-checkin
 * Allows a lecturer to manually mark a student as present (overriding geolocation).
 */
router.post("/session/:session_id/manual-checkin", async (req: Request, res: Response) => {
  const { session_id } = req.params;
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ success: false, message: "student_id is required" });
  }

  try {
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

    const now = new Date();
    if (session.is_expired === 1 || new Date(session.expires_at) < now) {
      return res.status(400).json({ success: false, message: "Session already expired" });
    }

    const [existing] = await db.query<any[]>(
      `SELECT checkin_id FROM Checkin WHERE session_id = ? AND student_id = ?`,
      [session_id, student_id]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Student already checked in",
        alreadyCheckedIn: true
      });
    }

    await db.query(
      `INSERT INTO Checkin (session_id, student_id, checkin_time, status)
       VALUES (?, ?, NOW(), 'checked-in')`,
      [session_id, student_id]
    );

    // Notify frontend to update UI instantly
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

// ============================================================================
//                            ANALYTICS & EXPORTS
// ============================================================================

/**
 * GET /:lecturer_id/analytics
 * Provides a dashboard overview of attendance rates for all classes taught by the lecturer.
 * Calculates status (Good/Warning/Critical) based on dynamic session counts.
 */
router.get("/:lecturer_id/analytics", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status='active' LIMIT 1`
    );
    if (semRows.length === 0)
      return res.status(404).json({ success: false, message: "No active semester" });

    const semester = semRows[0];

    const [classRows] = await db.query<any[]>(
      `SELECT class_id, class_name, course_code
       FROM Class
       WHERE lecturer_id = ?
       ORDER BY class_name`,
      [lecturer_id]
    );

    const results: any[] = [];

    for (const cls of classRows) {
      // 1) Dynamic Total: Count sessions in DB for this class/semester
      const [countRows] = await db.query<any[]>(
        `SELECT COUNT(*) AS total 
         FROM Session 
         WHERE class_id = ? 
           AND started_at BETWEEN ? AND ?`,
        [cls.class_id, semester.start_date, semester.end_date]
      );
      const totalSessions = countRows[0].total || 0;

      // 2) Get Past/Active sessions to calculate Actual Present vs Missed
      const [sessions] = await db.query<any[]>(
        `SELECT session_id
         FROM Session
         WHERE class_id = ?
           AND started_at BETWEEN ? AND ?
           AND started_at <= NOW()
         ORDER BY started_at ASC`,
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

        const [totalRows] = await db.query<any[]>(
          `SELECT COUNT(*) AS count FROM StudentClass WHERE class_id = ?`,
          [cls.class_id]
        );
        const totalStudents = totalRows[0].count;

        const missed = totalStudents - present;

        presentCount += present;
        missedCount += missed;
      }

      // 3) Attendance Rate Calculation
      const safeTotal = (presentCount + missedCount) === 0 ? 1 : (presentCount + missedCount);
      const attendanceRate =
        (presentCount + missedCount) === 0
          ? 0
          : Math.round((presentCount / safeTotal) * 100);

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
        attendance_status: status,
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

/**
 * GET /:lecturer_id/analytics/class/:class_id
 * Detailed analytics for a single class, including per-student performance.
 */
router.get("/:lecturer_id/analytics/class/:class_id", async (req: Request, res: Response) => {
  const { class_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status='active' LIMIT 1`
    );
    if (semRows.length === 0)
      return res.status(404).json({ success: false, message: "No active semester found" });

    const semester = semRows[0];

    // Get Students
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

    // Get Sessions
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

    const totalSessions = sessions.length;

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

    for (const sess of sessions) {
      const [presentRows] = await db.query<any[]>(
        `SELECT student_id FROM Checkin WHERE session_id = ?`,
        [sess.session_id]
      );

      const presentList = presentRows.map((r) => r.student_id);
      const presentCount = presentList.length;
      const totalStudents = studentRows.length;
      const missedCount = totalStudents - presentCount;

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
        attendance_rate: totalStudents === 0 ? 0 : Math.round((presentCount / totalStudents) * 100),
        online_mode: !!sess.online_mode
      });
    }

    // Build Student List with Dynamic Rate Logic
    const studentList = Object.values(studentMap).map((s: any) => {
      const safeTotal = totalSessions === 0 ? 1 : totalSessions;
      const attendanceRemaining = Math.max(0, totalSessions - s.missed_count);
      
      const rate = totalSessions === 0 
        ? 100 
        : Math.round((attendanceRemaining / safeTotal) * 100);

      let status: "good" | "warning" | "critical";
      if (rate >= 90) status = "good";
      else if (rate >= 80) status = "warning";
      else status = "critical";

      return { ...s, attendance_rate: rate, attendance_status: status };
    });

    const leastAttending = [...studentList].sort(
      (a, b) => a.attendance_rate - b.attendance_rate
    );

    return res.json({
      success: true,
      summary: {
        total_sessions: totalSessions,
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

/**
 * GET /:lecturer_id/analytics/class/:class_id/export.csv
 * Generates a downloadable CSV report of attendance.
 * @query type - "students" (default) or "sessions"
 */
router.get("/:lecturer_id/analytics/class/:class_id/export.csv", async (req: Request, res: Response) => {
  const { class_id } = req.params;
  const type = (req.query.type as string) || "students";

  try {
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

    const totalSessions = sessions.length;

    if (type === "students") {
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
        const missed = totalSessions - present;
        
        const safeTotal = totalSessions === 0 ? 1 : totalSessions;
        const rate = Math.round((present / safeTotal) * 100);
        const status = rate >= 90 ? "good" : rate >= 80 ? "warning" : "critical";

        csv += `${st.student_id},${st.name},${st.email},${present},${missed},${rate},${status}\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      return res.send(csv);
    }

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