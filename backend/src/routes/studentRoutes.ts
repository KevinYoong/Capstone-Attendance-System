import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";

const router = Router();

// ============================================================================
//                                CONFIGURATION
// ============================================================================

// Maximum allowed distance in meters (Geofence radius)
// Use .env value or default to 500m
const MAX_DISTANCE_METERS = Number(process.env.CAMPUS_RADIUS) || 500;

// Campus Coordinates
// Defaults to Sunway University if .env is missing
const CAMPUS_LAT = Number(process.env.CAMPUS_LATITUDE) || 3.0671;
const CAMPUS_LNG = Number(process.env.CAMPUS_LONGITUDE) || 101.6035;

console.log(`📍 Geofence Configured: Lat ${CAMPUS_LAT}, Lng ${CAMPUS_LNG}, Radius ${MAX_DISTANCE_METERS}m`);

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
  lecturer_name: string;
}

interface Week {
  Monday: ClassRow[];
  Tuesday: ClassRow[];
  Wednesday: ClassRow[];
  Thursday: ClassRow[];
  Friday: ClassRow[];
}

interface SessionRow extends RowDataPacket {
  session_id: number;
  class_id: number;
  started_at: Date;
  expires_at: Date;
  online_mode: boolean; // 0 or 1
  is_expired: boolean;  // 0 or 1
  scheduled_date: string; // YYYY-MM-DD
}

// ============================================================================
//                                HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates the distance between two geographic points using the Haversine formula.
 * @param lat1 User Latitude
 * @param lon1 User Longitude
 * @param lat2 Target Latitude
 * @param lon2 Target Longitude
 * @returns Distance in meters
 */
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// ============================================================================
//                                SCHEDULE ROUTES
// ============================================================================

/**
 * GET /:student_id/classes/week
 * Retrieves the student's weekly class schedule.
 * @query week - Optional week number or "break" to filter logic.
 */
router.get("/:student_id/classes/week", async (req: Request, res: Response) => {
  const { student_id } = req.params;
  const selectedWeek = req.query.week;

  // If it's a semester break, return empty schedule
  if (selectedWeek === "break") {
    return res.json({
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
    });
  }

  try {
    // Note: Use LEFT JOIN to allow classes without assigned lecturers
    const [rows] = await db.query<ClassRow[]>(
      `
      SELECT c.*, l.name AS lecturer_name
      FROM StudentClass sc
      JOIN Class c ON sc.class_id = c.class_id
      LEFT JOIN Lecturer l ON c.lecturer_id = l.lecturer_id
      WHERE sc.student_id = ?
      ORDER BY FIELD(c.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'), c.start_time
      `,
      [student_id]
    );

    const week: Week = {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
    };

    rows.forEach((cls) => {
      if (week[cls.day_of_week]) {
        week[cls.day_of_week].push(cls);
      }
    });

    res.json(week);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving schedule" });
  }
});

// ============================================================================
//                            CHECK-IN & SESSIONS
// ============================================================================

/**
 * GET /:student_id/active-sessions
 * Finds all currently active sessions for classes the student is enrolled in.
 * Used to populate the "Check In Now" buttons on the dashboard.
 */
router.get("/:student_id/active-sessions", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    const [sessions] = await db.query<SessionRow[]>(
      `
      SELECT s.session_id, s.class_id, s.started_at, s.expires_at, s.online_mode, s.scheduled_date
      FROM Session s
      JOIN StudentClass sc ON s.class_id = sc.class_id
      WHERE sc.student_id = ?
        AND s.is_expired = 0
        AND s.expires_at > NOW()
      `,
      [student_id]
    );

    return res.json({ success: true, sessions });
  } catch (err) {
    console.error("Error fetching student active sessions:", err);
    return res.status(500).json({ success: false, message: "Error fetching sessions" });
  }
});

/**
 * POST /checkin
 * Handles the student check-in process.
 * 1. Validates session existence and expiry.
 * 2. Checks if already checked in.
 * 3. Verifies Geolocation (unless online_mode is active).
 * 4. Records attendance and notifies socket room.
 */
router.post("/checkin", async (req: Request, res: Response) => {
  const { student_id, session_id, latitude, longitude } = req.body;

  if (!student_id || !session_id) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    // 1. Fetch Session Info
    const [rows] = await db.query<SessionRow[]>(
      `SELECT * FROM Session WHERE session_id = ?`, 
      [session_id]
    );
    const session = rows[0];

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (session.is_expired || new Date(session.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "Session expired" });
    }

    // 2. Check for duplicate check-in
    const [existing] = await db.query<any[]>(
      `SELECT checkin_id FROM Checkin WHERE session_id = ? AND student_id = ?`,
      [session_id, student_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Already checked in" });
    }

    // 3. Geolocation Verification (if not in online mode)
    if (!session.online_mode) {
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Location required" });
      }

      const distance = getDistanceFromLatLonInM(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
      console.log(`📍 Check-in Distance: ${distance.toFixed(2)}m (Max: ${MAX_DISTANCE_METERS}m)`);

      if (distance > MAX_DISTANCE_METERS) {
        return res.status(403).json({
          success: false,
          message: `Too far from campus (${distance.toFixed(0)}m). Must be within ${MAX_DISTANCE_METERS}m.`
        });
      }
    }

    // 4. Record Success
    await db.query(
      `INSERT INTO Checkin (session_id, student_id, checkin_time, status, latitude, longitude, distance_from_campus)
       VALUES (?, ?, NOW(), 'present', ?, ?, ?)`,
      [
        session_id, 
        student_id, 
        session.online_mode ? null : latitude, 
        session.online_mode ? null : longitude,
        session.online_mode ? null : 0 
      ] // Note: distance is saved as 0 or null during online mode logic
    );

    // Notify Lecturer/Room
    io.to(`class_${session.class_id}`).emit("studentCheckedIn", {
      class_id: session.class_id,
      student_id,
      session_id
    });

    return res.json({ success: true, message: "Check-in successful" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ============================================================================
//                            ATTENDANCE ANALYTICS
// ============================================================================
/**
 * GET /:student_id/analytics
 * Specifically for the StudentAnalyticsOverview page.
 * Returns a high-level summary of all enrolled classes.
 */
router.get("/:student_id/analytics", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(`SELECT * FROM Semester WHERE status = 'active' LIMIT 1`);
    if (semRows.length === 0) return res.status(404).json({ success: false, message: "No active semester" });
    const semester = semRows[0];

    const [summaryRows] = await db.query<any[]>(
      `
      SELECT 
        c.class_id, 
        c.class_name, 
        c.course_code,
        l.name AS lecturer_name,
        COUNT(s.session_id) AS total_sessions,
        /* FIXED: Only count as present if the status is present/checked-in */
        SUM(CASE WHEN ci.status IN ('present', 'checked-in') THEN 1 ELSE 0 END) AS present_count,
        /* FIXED: Count as missed if status is 'missed' OR if session expired with no record */
        SUM(CASE WHEN ci.status = 'missed' OR (s.is_expired = 1 AND ci.checkin_id IS NULL) THEN 1 ELSE 0 END) AS missed_count
      FROM StudentClass sc
      JOIN Class c ON sc.class_id = c.class_id
      JOIN Lecturer l ON c.lecturer_id = l.lecturer_id
      LEFT JOIN Session s ON s.class_id = c.class_id 
        AND s.started_at BETWEEN ? AND ?
        AND (s.expires_at < NOW() OR s.is_expired = 1)
      LEFT JOIN Checkin ci ON ci.session_id = s.session_id AND ci.student_id = sc.student_id
      WHERE sc.student_id = ?
      GROUP BY c.class_id
      `,
      [semester.start_date, semester.end_date, student_id]
    );

    const classes = summaryRows.map(cls => {
      // Logic: Attendance Rate = (Present / Total Sessions)
      const total = Number(cls.total_sessions);
      const present = Number(cls.present_count);
      const rate = total === 0 ? 100 : Math.round((present / total) * 100);

      return {
        ...cls,
        present_count: present,
        missed_count: Number(cls.missed_count),
        attendance_rate: rate,
        attendance_status: rate >= 90 ? "good" : rate >= 80 ? "warning" : "critical"
      };
    });

    res.json({ success: true, semester, classes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * GET /:student_id/attendance/semester
 * Returns the student's attendance history for the active semester.
 * Includes a summary calculation (Present/Missed/Rate) for each class.
 */
router.get("/:student_id/attendance/semester", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(`SELECT * FROM Semester WHERE status='active' LIMIT 1`);
    if (semRows.length === 0) return res.status(404).json({ success: false, message: "No active semester" });
    const semester = semRows[0];

    // This query ensures we get the exact fields the StudentDashboard needs
    const [attendanceRows] = await db.query<any[]>(
      `
      SELECT 
        s.session_id, 
        s.class_id, 
        s.started_at, 
        s.scheduled_date,
        s.expires_at,
        s.is_expired,
        c.status AS db_status
      FROM Session s
      JOIN StudentClass sc ON s.class_id = sc.class_id
      LEFT JOIN Checkin c ON s.session_id = c.session_id AND c.student_id = sc.student_id
      WHERE sc.student_id = ?
        AND s.started_at BETWEEN ? AND ?
      ORDER BY s.started_at DESC
      `,
      [student_id, semester.start_date, semester.end_date]
    );

    // Map statuses to exactly what StudentDashboard.tsx expects
    const attendance = attendanceRows.map(s => {
      let status = s.db_status;
      if (!status) {
        status = (s.is_expired || new Date(s.expires_at) < new Date()) ? "missed" : "pending";
      }
      // Standardize 'present' to 'checked-in' if that's what your dashboard logic uses
      if (status === 'present') status = 'checked-in';

      return {
        ...s,
        student_status: status,
        scheduled_date: s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString('en-CA') : null
      };
    });

    // Generate Summary (Keep this as an ARRAY for cleaner mapping in Analytics)
    const summaryMap: Record<number, any> = {};
    attendance.forEach(a => {
      if (!summaryMap[a.class_id]) {
        summaryMap[a.class_id] = { class_id: a.class_id, present: 0, missed: 0, total: 0 };
      }
      summaryMap[a.class_id].total++;
      if (a.student_status === 'checked-in') summaryMap[a.class_id].present++;
      if (a.student_status === 'missed') summaryMap[a.class_id].missed++;
    });

    const summaryArray = Object.values(summaryMap).map((item: any) => {
      const rate = item.total === 0 ? 100 : Math.round((item.present / item.total) * 100);
      return {
        ...item,
        attendance_rate: rate,
        attendance_status: rate >= 90 ? "good" : rate >= 80 ? "warning" : "critical"
      };
    });

    res.json({
      success: true,
      attendance,
      summary_by_class: summaryArray // Analytics page needs this as an array
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /:student_id/analytics/class/:class_id
 * Retrieves detailed attendance history for a single class.
 */
router.get("/:student_id/analytics/class/:class_id", async (req: Request, res: Response) => {
  const { student_id, class_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(`SELECT * FROM Semester WHERE status='active' LIMIT 1`);
    if (semRows.length === 0) return res.status(404).json({ message: "No active semester" });
    const semester = semRows[0];

    // 1) Get Class Info
    const [cRows] = await db.query<any[]>(
      `SELECT class_name, course_code, class_type FROM Class WHERE class_id = ?`,
      [class_id]
    );
    const classInfo = cRows[0];

    // 2) Get Session History
    const [sessions] = await db.query<any[]>(
      `
      SELECT s.session_id, s.started_at, s.expires_at,
             c.status AS checkin_status, c.checkin_time
      FROM Session s
      LEFT JOIN Checkin c ON s.session_id = c.session_id AND c.student_id = ?
      WHERE s.class_id = ? AND s.started_at BETWEEN ? AND ?
      ORDER BY s.started_at DESC
      `,
      [student_id, class_id, semester.start_date, semester.end_date]
    );

    // 3) Calculate Stats
    let presentCount = 0;
    let missedCount = 0;

    const formattedSessions = sessions.map(sess => {
      let status = sess.checkin_status;
      
      // If no checkin record, determine if it was missed or is still pending
      if (!status) {
        status = (new Date(sess.expires_at) < new Date()) ? "missed" : "pending";
      }

      if (status === "present" || status === "checked-in") presentCount++;
      if (status === "missed") missedCount++;

      return {
        session_id: sess.session_id,
        started_at: sess.started_at,
        status: status,
        checkin_time: sess.checkin_time
      };
    });

    const totalHeld = presentCount + missedCount;
    const rate = totalHeld === 0 ? 100 : Math.round((presentCount / totalHeld) * 100);

    return res.json({
      success: true,
      class: {
        ...classInfo,
        total_sessions: totalHeld,
        present_count: presentCount,
        missed_count: missedCount,
        attendance_rate: rate,
        attendance_status: rate >= 90 ? "good" : rate >= 80 ? "warning" : "critical",
        sessions: formattedSessions
      }
    });

  } catch (err) {
    console.error("Student class analytics error:", err);
    return res.status(500).json({ success: false, message: "Error loading analytics" });
  }
});

export default router;