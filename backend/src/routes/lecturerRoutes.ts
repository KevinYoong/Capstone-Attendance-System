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

// ----- ROUTES -----

// Get weekly schedule for a lecturer
router.get("/:lecturer_id/classes/week", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;
  const { week } = req.query; // Accept week parameter (optional for now)
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
      SELECT session_id, class_id, started_at, expires_at, online_mode, is_expired
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
        expires_at: session.expires_at,
        online_mode: !!session.online_mode,
        is_expired: !!session.is_expired
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
        SELECT s.session_id, s.class_id, s.started_at, s.expires_at, s.online_mode, s.is_expired
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

  try {
    // Get class info
    const [classRows] = await db.query<ClassRow[]>(
      `SELECT * FROM Class WHERE class_id = ?`,
      [class_id]
    );
    const classInfo = classRows[0];
    if (!classInfo) return res.status(404).json({ message: "Class not found" });

    // Get enrolled students
    const [studentRows] = await db.query<StudentRow[]>(
      `
      SELECT Student.student_id, Student.name, Student.email
      FROM StudentClass
      JOIN Student ON StudentClass.student_id = Student.student_id
      WHERE StudentClass.class_id = ?
      `,
      [class_id]
    );

    // Get latest session (if any)
    const [sessionRows] = await db.query<SessionRow[]>(
      `SELECT * FROM Session WHERE class_id = ? ORDER BY started_at DESC LIMIT 1`,
      [class_id]
    );
    const latestSession = sessionRows.length > 0 ? sessionRows[0] : null;

    // Get check-ins for this session
    let checkins: CheckinRow[] = [];
    if (latestSession) {
      const [checkinRows] = await db.query<CheckinRow[]>(
        `SELECT * FROM Checkin WHERE session_id = ?`,
        [latestSession.session_id]
      );
      checkins = checkinRows;
    }

    res.json({
      classInfo,
      students: studentRows,
      session: latestSession,
      checkins,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving class details" });
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
    const [activeRows] = await conn.query(
      `SELECT session_id, started_at, expires_at, online_mode
      FROM Session 
      WHERE class_id = ? AND is_expired = 0 AND expires_at > NOW() 
      ORDER BY started_at DESC LIMIT 1`,
      [class_id]
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
    const { online_mode } = req.body;
    const isOnlineMode: boolean = online_mode === true;

    const [result] = await conn.query(
      `INSERT INTO Session (class_id, started_at, expires_at, online_mode, is_expired)
       VALUES (?, ?, ?, ?, 0)`,
      [class_id, startedAt, expiresAt, isOnlineMode ? 1 : 0]
    );

    const session_id = (result as any).insertId;

    await conn.commit();
    conn.release();

    // Emit to this class room only
    io.to(`class_${class_id}`).emit("checkinActivated", {
      class_id: Number(class_id),
      session_id,
      startedAt,
      expiresAt,
      online_mode: isOnlineMode
    });

    return res.status(201).json({
      message: "Check-in activated",
      session_id,
      started_at: startedAt,
      expires_at: expiresAt,
      online_mode: isOnlineMode
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

export default router;