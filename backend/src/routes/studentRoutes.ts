import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";

const router = Router();

// ==========================================
// Types & Interfaces
// ==========================================

interface ClassRow extends RowDataPacket {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  start_time: string; // TIME is returned as string by mysql2
  end_time: string;
  class_type: "Lecture" | "Tutorial";
  lecturer_name: string;
}

interface SessionRow extends RowDataPacket {
  session_id: number;
  class_id: number;
  started_at: Date;
  expires_at: Date;
  online_mode: number;
}

interface CheckinRow extends RowDataPacket {
  checkin_id: number;
  session_id: number;
  student_id: number;
  checkin_time: Date;
  status: string;
}

type Week = {
  Monday: ClassRow[];
  Tuesday: ClassRow[];
  Wednesday: ClassRow[];
  Thursday: ClassRow[];
  Friday: ClassRow[];
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 * @returns Distance in meters (rounded).
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters

  // Convert degrees to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula implementation
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance);
}

// ==========================================
// Routes
// ==========================================

/**
 * GET /:student_id/classes/week
 * Retrieves the weekly class schedule for a student.
 */
router.get("/:student_id/classes/week", async (req: Request, res: Response) => {
  const { student_id } = req.params;
  const selectedWeek = req.query.week;

  if (selectedWeek === "break") {
    return res.json({
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    });
  }

  try {
    const [rows] = await db.query<ClassRow[]>(
      `
      SELECT
        Class.class_id,
        Class.class_name,
        Class.course_code,
        Class.day_of_week,
        Class.start_time,
        Class.end_time,
        Class.class_type,
        Lecturer.name AS lecturer_name
      FROM StudentClass
      JOIN Class ON StudentClass.class_id = Class.class_id
      JOIN Lecturer ON Class.lecturer_id = Lecturer.lecturer_id
      WHERE StudentClass.student_id = ?
      ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time;
      `,
      [student_id]
    );

    const week: Week = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };

    // Distribute classes into the correct day buckets
    rows.forEach((cls) => {
      const day = cls.day_of_week as keyof Week;
      week[day].push(cls);
    });

    res.json(week);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving class schedule" });
  }
});

/**
 * GET /:student_id/attendance/semester
 * Retrieves attendance summary for the active semester.
 * Note: Uses a fixed 14-week calculation rule for status.
 */
router.get("/:student_id/attendance/semester", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );
    const semester = semRows[0];

    const [sessionRows] = await db.query<any[]>(
      `
      SELECT 
        s.session_id,
        s.class_id,
        s.started_at,
        s.expires_at,
        s.online_mode,
        s.is_expired,
        s.scheduled_date,  
        c.class_name,
        c.course_code,
        ci.status AS student_status
      FROM Session s
      JOIN Class c ON c.class_id = s.class_id
      JOIN StudentClass sc ON sc.class_id = s.class_id AND sc.student_id = ?
      LEFT JOIN Checkin ci 
        ON ci.session_id = s.session_id 
       AND ci.student_id = ?
      WHERE s.started_at BETWEEN ? AND ?
      ORDER BY s.started_at ASC
      `,
      [student_id, student_id, semester.start_date, semester.end_date]
    );

    // Map rows to clean response objects with formatted dates
    const attendance = sessionRows.map((s) => {
      let status = s.student_status;
      if (!status) {
        status = s.is_expired ? "missed" : "pending";
      }

      return {
        session_id: s.session_id,
        class_id: s.class_id,
        class_name: s.class_name,
        course_code: s.course_code,
        started_at: s.started_at,
        expires_at: s.expires_at,
        online_mode: s.online_mode,
        student_status: status,
        scheduled_date: s.scheduled_date
          ? new Date(s.scheduled_date).toLocaleDateString("en-CA")
          : null,
      };
    });

    // Build per-class summary for analytics
    const summaryByClass: Record<number, any> = {};

    attendance.forEach((a) => {
      if (!summaryByClass[a.class_id]) {
        summaryByClass[a.class_id] = {
          class_id: a.class_id,
          class_name: a.class_name,
          course_code: a.course_code,
          missed_count: 0,
        };
      }

      const cls = summaryByClass[a.class_id];

      if (a.student_status === "missed") {
        cls.missed_count++;
      }
    });

    // Apply the 14-week rule for attendance grading
    const FINAL_TOTAL = 14;

    Object.values(summaryByClass).forEach((cls: any) => {
      const missed = cls.missed_count;
      const present = FINAL_TOTAL - missed;
      const attendance_rate = Math.round((present / FINAL_TOTAL) * 100);

      let status: "good" | "warning" | "critical";
      if (attendance_rate >= 90) status = "good";
      else if (attendance_rate >= 80) status = "warning";
      else status = "critical";

      cls.total_sessions = FINAL_TOTAL;
      cls.present_count = present;
      cls.missed_count = missed;
      cls.attendance_rate = attendance_rate;
      cls.attendance_status = status;
    });

    return res.json({
      success: true,
      semester,
      attendance,
      summary_by_class: Object.values(summaryByClass),
    });

  } catch (err) {
    console.error("Error loading semester attendance:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load semester attendance",
    });
  }
});

/**
 * GET /:student_id/active-sessions
 * Fetches sessions that are currently running/active.
 */
router.get("/:student_id/active-sessions", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  console.log(`🔍 [API] Fetching active sessions for Student ID: ${student_id}`);

  try {
    const [rows] = await db.query<any[]>(
      `
      SELECT s.session_id, s.class_id, s.started_at, s.expires_at, s.online_mode, s.scheduled_date
      FROM Session s
      JOIN StudentClass sc ON sc.class_id = s.class_id
      WHERE sc.student_id = ?
        AND s.expires_at > NOW()
        AND (s.is_expired = 0 OR s.is_expired IS NULL)
      ORDER BY s.expires_at ASC
      `,
      [student_id]
    );

    console.log(`📊 [DB] Raw Active Sessions Found: ${rows.length}`, rows);

    const sessions = rows.map((r) => {
      const rawDate = r.scheduled_date;
      const formattedDate = rawDate
        ? new Date(rawDate).toLocaleDateString("en-CA")
        : null;

      console.log(`🗓️ [Map] Session ${r.session_id}: Raw Date: ${rawDate} -> Formatted: ${formattedDate}`);

      return {
        session_id: r.session_id,
        class_id: r.class_id,
        started_at: r.started_at,
        expires_at: r.expires_at,
        online_mode: !!r.online_mode,
        scheduled_date: formattedDate,
      };
    });

    return res.json({ success: true, sessions });
  } catch (err) {
    console.error("Error fetching active sessions:", err);
    return res.status(500).json({ success: false, message: "Error fetching active sessions" });
  }
});

/**
 * POST /session-started
 * Emits a socket event when a lecturer starts a session.
 */
router.post("/session-started", (req: Request, res: Response) => {
  const { class_id, started_at, expires_at } = req.body;
  io.emit("session_started", { class_id, started_at, expires_at });
  res.json({ message: "Event emitted" });
});

/**
 * POST /checkin
 * Handles student check-in with validation for session expiry, location (geofencing), and duplicates.
 */
router.post("/checkin", async (req: Request, res: Response) => {
  const { student_id, session_id, latitude, longitude, accuracy } = req.body;

  // Validate required inputs
  if (!student_id || !session_id) {
    return res.status(400).json({
      success: false,
      message: "student_id and session_id are required",
    });
  }

  if (latitude === undefined || longitude === undefined || accuracy === undefined) {
    return res.status(400).json({
      success: false,
      message: "Geolocation data (latitude, longitude, accuracy) is required",
    });
  }

  try {
    // 1. Check if session exists and is valid
    const [sessionRows] = await db.query<SessionRow[]>(
      `SELECT session_id, class_id, started_at, expires_at, online_mode, scheduled_date
       FROM Session
       WHERE session_id = ?`,
      [session_id]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const session = sessionRows[0];

    // 2. Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({ success: false, message: "Session has expired" });
    }

    // 3. Geolocation validation (Skipped if online_mode is active)
    if (session.online_mode === 0) {
      const campusLat = parseFloat(process.env.CAMPUS_LATITUDE || "0");
      const campusLng = parseFloat(process.env.CAMPUS_LONGITUDE || "0");
      const campusRadius = parseFloat(process.env.CAMPUS_RADIUS || "500");

      if (campusLat === 0 || campusLng === 0) {
        return res.status(500).json({ success: false, message: "Campus location not configured" });
      }

      const distance = calculateDistance(latitude, longitude, campusLat, campusLng);

      console.log(`Check-in validation: Student at (${latitude}, ${longitude}), Campus at (${campusLat}, ${campusLng}), Distance: ${distance}m, Accuracy: ${accuracy}m, Allowed radius: ${campusRadius}m`);

      if (distance > campusRadius) {
        return res.status(403).json({
          success: false,
          message: `You are too far from campus. Distance: ${distance}m (max: ${campusRadius}m)`,
        });
      }

      if (accuracy > 100) {
        console.warn(`Warning: Poor GPS accuracy (${accuracy}m) for student ${student_id}`);
      }
    }

    // 4. Check for existing check-ins
    const [existingCheckins] = await db.query<CheckinRow[]>(
      `SELECT checkin_id FROM Checkin WHERE session_id = ? AND student_id = ?`,
      [session_id, student_id]
    );

    if (existingCheckins.length > 0) {
      return res.status(400).json({ success: false, message: "Already checked in for this session" });
    }

    // 5. Record the check-in
    await db.query(
      `INSERT INTO Checkin (session_id, student_id, checkin_time, status, student_lat, student_lng, accuracy)
       VALUES (?, ?, NOW(), 'present', ?, ?, ?)`,
      [session_id, student_id, latitude, longitude, accuracy]
    );

    // 6. Notify clients via Socket.IO
    io.to(`class_${session.class_id}`).emit("studentCheckedIn", {
      class_id: session.class_id,
      session_id: session_id,
      student_id: student_id,
      checkin_time: new Date(),
      status: "present",
    });

    return res.status(200).json({
      success: true,
      message: "Check-in successful",
      data: {
        session_id: session_id,
        student_id: student_id,
        status: "present",
      },
    });

  } catch (error) {
    console.error("Check-in error:", error);
    return res.status(500).json({ success: false, message: "Error processing check-in" });
  }
});

/**
 * GET /:student_id/analytics
 * Provides a semester overview for the student (grades based on DB session counts).
 */
router.get("/:student_id/analytics", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    // Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );
    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester found" });
    }
    const semester = semRows[0];

    // Get enrolled classes
    const [classRows] = await db.query<any[]>(
      `
      SELECT 
        c.class_id, 
        c.class_name, 
        c.course_code,
        c.class_type,
        l.name AS lecturer_name
      FROM StudentClass sc
      JOIN Class c ON c.class_id = sc.class_id
      JOIN Lecturer l ON l.lecturer_id = c.lecturer_id
      WHERE sc.student_id = ?
      ORDER BY c.class_name
      `,
      [student_id]
    );

    const summaryResults: any[] = [];

    for (const cls of classRows) {
      // Get total sessions count from DB
      const [countRows] = await db.query<any[]>(
        `SELECT COUNT(*) AS total 
         FROM Session 
         WHERE class_id = ? 
           AND started_at BETWEEN ? AND ?`,
        [cls.class_id, semester.start_date, semester.end_date]
      );
      const totalSessions = countRows[0].total || 0;

      // Get sessions to calculate missed count
      const [sessions] = await db.query<any[]>(
        `
        SELECT s.session_id, s.started_at, s.expires_at, s.is_expired
        FROM Session s
        WHERE s.class_id = ?
          AND s.started_at BETWEEN ? AND ?
          AND s.started_at <= NOW() 
        ORDER BY s.started_at ASC
        `,
        [cls.class_id, semester.start_date, semester.end_date]
      );

      let actualMissedCount = 0;

      for (const sess of sessions) {
        const [check] = await db.query<any[]>(
          `SELECT status FROM Checkin WHERE session_id = ? AND student_id = ? LIMIT 1`,
          [sess.session_id, student_id]
        );

        const now = new Date();
        const expiresAt = new Date(sess.expires_at);
        const isExpired = sess.is_expired === 1 || now > expiresAt;
        let isMissed = false;

        if (check.length > 0) {
          if (check[0].status === "missed") isMissed = true;
        } else {
          // No record + Session expired = Missed
          if (isExpired) isMissed = true;
        }

        if (isMissed) actualMissedCount++;
      }

      // Calculate score dynamically based on DB totals
      const safeTotal = totalSessions === 0 ? 1 : totalSessions;
      const projectedPresent = Math.max(0, totalSessions - actualMissedCount);

      const attendance_rate =
        totalSessions === 0 ? 100 : Math.round((projectedPresent / safeTotal) * 100);

      let attendance_status: "good" | "warning" | "critical";
      if (attendance_rate >= 90) attendance_status = "good";
      else if (attendance_rate >= 80) attendance_status = "warning";
      else attendance_status = "critical";

      summaryResults.push({
        class_id: cls.class_id,
        class_name: cls.class_name,
        course_code: cls.course_code,
        lecturer_name: cls.lecturer_name,
        total_sessions: totalSessions,
        present_count: projectedPresent,
        missed_count: actualMissedCount,
        attendance_rate: attendance_rate,
        attendance_status: attendance_status,
      });
    }

    return res.json({
      success: true,
      semester,
      classes: summaryResults,
    });
  } catch (err) {
    console.error("Error fetching student analytics:", err);
    return res.status(500).json({ success: false, message: "Error loading student analytics" });
  }
});

/**
 * GET /:student_id/analytics/class/:class_id
 * Detailed analytics for a specific class.
 */
router.get("/:student_id/analytics/class/:class_id", async (req: Request, res: Response) => {
  const { student_id, class_id } = req.params;

  try {
    // Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );
    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester found" });
    }
    const semester = semRows[0];

    // Validate enrollment
    const [enrollmentRows] = await db.query<any[]>(
      `
      SELECT c.class_id, c.class_name, c.course_code, c.class_type,
             l.name AS lecturer_name
      FROM StudentClass sc
      JOIN Class c ON c.class_id = sc.class_id
      JOIN Lecturer l ON l.lecturer_id = c.lecturer_id
      WHERE sc.student_id = ? AND sc.class_id = ?
      `,
      [student_id, class_id]
    );

    if (enrollmentRows.length === 0) {
      return res.status(403).json({ success: false, message: "Student is not enrolled in this class" });
    }
    const classInfo = enrollmentRows[0];

    // Get ALL sessions (Past and Future)
    const [sessions] = await db.query<any[]>(
      `
      SELECT s.session_id, s.started_at, s.expires_at, s.is_expired, s.online_mode
      FROM Session s
      WHERE s.class_id = ?
        AND s.started_at BETWEEN ? AND ?
      ORDER BY s.started_at ASC
      `,
      [class_id, semester.start_date, semester.end_date]
    );

    const totalSessions = sessions.length;
    let actualMissedCount = 0;
    const sessionDetails: any[] = [];
    const now = new Date();

    // Check attendance for each session
    for (const sess of sessions) {
      const [check] = await db.query<any[]>(
        `SELECT status, checkin_time FROM Checkin WHERE session_id = ? AND student_id = ? LIMIT 1`,
        [sess.session_id, student_id]
      );

      const expiresAt = new Date(sess.expires_at);
      const isExpired = sess.is_expired === 1 || now > expiresAt;

      let status = "pending";
      let checkinTime = null;

      if (check.length > 0) {
        const dbStatus = check[0].status;
        checkinTime = check[0].checkin_time;

        if (dbStatus === "present" || dbStatus === "checked-in") {
          status = "present";
        } else if (dbStatus === "missed") {
          status = "missed";
          actualMissedCount++;
        }
      } else {
        if (isExpired) {
          status = "missed";
          actualMissedCount++;
        }
      }

      sessionDetails.push({
        session_id: sess.session_id,
        started_at: sess.started_at,
        expires_at: sess.expires_at,
        online_mode: !!sess.online_mode,
        status: status,
        checkin_time: checkinTime,
      });
    }

    // Calculate Statistics
    const safeTotal = totalSessions === 0 ? 1 : totalSessions;
    const attendanceRemaining = Math.max(0, totalSessions - actualMissedCount);

    const attendanceRate =
      totalSessions === 0 ? 100 : Math.round((attendanceRemaining / safeTotal) * 100);

    let attStatus: "good" | "warning" | "critical";
    if (attendanceRate >= 90) attStatus = "good";
    else if (attendanceRate >= 80) attStatus = "warning";
    else attStatus = "critical";

    const sessionsHeld = sessionDetails.filter((s) => s.status !== "pending").length;
    const remainingSessions = Math.max(0, totalSessions - sessionsHeld);

    return res.json({
      success: true,
      semester,
      class: {
        ...classInfo,
        total_sessions: totalSessions,
        present_count: attendanceRemaining,
        missed_count: actualMissedCount,
        attendance_rate: attendanceRate,
        attendance_status: attStatus,
        sessions: sessionDetails,
        insights: {
          remaining_sessions: remainingSessions,
          projected_final_rate: attendanceRate,
          is_at_risk: attendanceRate < 80,
          is_warning: attendanceRate >= 80 && attendanceRate < 90,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching class analytics:", err);
    return res.status(500).json({ success: false, message: "Error fetching class analytics" });
  }
});

export default router;