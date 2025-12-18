import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";

const router = Router();

// ============================================================================
//                                CONFIGURATION
// ============================================================================

// Maximum allowed distance in meters (Geofence radius)
const MAX_DISTANCE_METERS = 500;

// Campus Coordinates (Sunway University)
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
 * GET /:student_id/attendance/semester
 * Returns the student's attendance history for the active semester.
 * Includes a summary calculation (Present/Missed/Rate) for each class.
 */
router.get("/:student_id/attendance/semester", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    // 1. Get Active Semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status='active' LIMIT 1`
    );
    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester" });
    }
    const semester = semRows[0];

    // 2. Fetch all session history for this student
    // Includes status: 'present' (from checkin) or 'missed' (implied)
    const [attendanceRows] = await db.query<any[]>(
      `
      SELECT 
        s.session_id, 
        s.class_id, 
        s.started_at, 
        s.scheduled_date,
        c.checkin_time,
        CASE 
          WHEN c.checkin_id IS NOT NULL THEN 'present'
          WHEN c.checkin_id IS NOT NULL AND c.status = 'checked-in' THEN 'present' 
          WHEN s.expires_at < NOW() AND c.checkin_id IS NULL THEN 'missed'
          ELSE 'pending'
        END as student_status
      FROM Session s
      JOIN StudentClass sc ON s.class_id = sc.class_id
      LEFT JOIN Checkin c ON s.session_id = c.session_id AND c.student_id = sc.student_id
      WHERE sc.student_id = ?
        AND s.started_at BETWEEN ? AND ?
      ORDER BY s.started_at DESC
      `,
      [student_id, semester.start_date, semester.end_date]
    );

    // 3. Calculate Summary per Class
    const classSummary: Record<number, any> = {};

    // Get list of classes to ensure we have buckets for all enrolled classes
    const [enrolledClasses] = await db.query<any[]>(
      `SELECT c.class_id, c.class_name, c.course_code 
       FROM StudentClass sc 
       JOIN Class c ON sc.class_id = c.class_id 
       WHERE sc.student_id = ?`,
      [student_id]
    );

    // Initialize counters
    for (const cls of enrolledClasses) {
      // Count total sessions held in the database for this class
      const [sessCount] = await db.query<any[]>(
        `SELECT COUNT(*) as count FROM Session WHERE class_id = ? AND started_at BETWEEN ? AND ?`,
        [cls.class_id, semester.start_date, semester.end_date]
      );
      const totalSessions = sessCount[0].count;

      classSummary[cls.class_id] = {
        class_name: cls.class_name,
        course_code: cls.course_code,
        total_sessions: totalSessions,
        present: 0,
        missed: 0,
      };
    }

    // Populate counts based on attendance rows
    for (const row of attendanceRows) {
      if (classSummary[row.class_id]) {
        if (row.student_status === 'present' || row.student_status === 'checked-in') {
          classSummary[row.class_id].present++;
        } else if (row.student_status === 'missed') {
          classSummary[row.class_id].missed++;
        }
      }
    }

    // 4. Calculate Final Rates & Status
    const summaryArray = Object.values(classSummary).map((item: any) => {
      // "Safe Total" prevents division by zero
      const safeTotal = item.total_sessions === 0 ? 1 : item.total_sessions;
      
      // Calculate remaining sessions (Total - Missed) vs Total
      // This is a "Retention Rate" logic: You start at 100% and drop as you miss classes
      const attendanceRemaining = Math.max(0, item.total_sessions - item.missed);
      const rate = item.total_sessions === 0 
        ? 100 
        : Math.round((attendanceRemaining / safeTotal) * 100);

      let status = "good";
      if (rate < 80) status = "critical";
      else if (rate < 90) status = "warning";

      return {
        ...item,
        attendance_rate: rate,
        attendance_status: status
      };
    });

    res.json({
      success: true,
      attendance: attendanceRows,
      summary_by_class: summaryArray
    });

  } catch (err) {
    console.error("Error fetching semester attendance:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /:student_id/analytics/class/:class_id
 * Retrieves detailed analytics for a single class.
 * Includes projections like "Remaining sessions" and "At Risk" flags.
 */
router.get("/:student_id/analytics/class/:class_id", async (req: Request, res: Response) => {
  const { student_id, class_id } = req.params;

  try {
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status='active' LIMIT 1`
    );
    if (semRows.length === 0) return res.status(404).json({ message: "No active semester" });
    const semester = semRows[0];

    // 1) Class Info
    const [cRows] = await db.query<any[]>(
      `SELECT class_name, course_code, class_type, lecturer_id FROM Class WHERE class_id = ?`,
      [class_id]
    );
    const classInfo = cRows[0];

    // 2) Sessions & Checkins
    const [sessions] = await db.query<any[]>(
      `
      SELECT session_id, started_at, scheduled_date, expires_at
      FROM Session
      WHERE class_id = ?
        AND started_at BETWEEN ? AND ?
      ORDER BY started_at ASC
      `,
      [class_id, semester.start_date, semester.end_date]
    );

    const totalSessions = sessions.length;
    let actualPresentCount = 0;
    let actualMissedCount = 0;

    const sessionDetails = [];

    for (const sess of sessions) {
      const [checkin] = await db.query<any[]>(
        `SELECT status, checkin_time FROM Checkin WHERE session_id = ? AND student_id = ?`,
        [sess.session_id, student_id]
      );

      let status = "pending";
      let checkinTime = null;

      if (checkin.length > 0) {
        status = checkin[0].status; // 'present' or 'checked-in'
        checkinTime = checkin[0].checkin_time;
      } else if (new Date(sess.expires_at) < new Date()) {
        status = "missed";
      }

      if (status === "present" || status === "checked-in") actualPresentCount++;
      if (status === "missed") actualMissedCount++;

      sessionDetails.push({
        session_id: sess.session_id,
        date: sess.started_at,
        scheduled_date: sess.scheduled_date,
        status,
        checkin_time: checkinTime
      });
    }

    // 3) Attendance Rate Logic (Retention-based)
    const safeTotal = totalSessions === 0 ? 1 : totalSessions;
    const attendanceRemaining = Math.max(0, totalSessions - actualMissedCount);
    
    const attendanceRate = totalSessions === 0 
      ? 100 
      : Math.round((attendanceRemaining / safeTotal) * 100);

    let attStatus: "good" | "warning" | "critical";
    if (attendanceRate >= 90) attStatus = "good";
    else if (attendanceRate >= 80) attStatus = "warning";
    else attStatus = "critical";

    const sessionsHeld = sessionDetails.filter(s => s.status !== 'pending').length;
    const remainingSessions = Math.max(0, totalSessions - sessionsHeld);

    return res.json({
      success: true,
      semester,
      class: {
        ...classInfo,
        total_sessions: totalSessions,
        present_count: attendanceRemaining, // Shows "Potential Present" score
        missed_count: actualMissedCount,
        attendance_rate: attendanceRate,
        attendance_status: attStatus,
        sessions: sessionDetails,
        insights: {
          remaining_sessions: remainingSessions,
          projected_final_rate: attendanceRate, 
          is_at_risk: attendanceRate < 80,
          is_warning: attendanceRate >= 80 && attendanceRate < 90
        }
      }
    });

  } catch (err) {
    console.error("Student class analytics error:", err);
    return res.status(500).json({ success: false, message: "Error loading analytics" });
  }
});

export default router;