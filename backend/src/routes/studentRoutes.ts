import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";

const router = Router();

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

// Week record type
type Week = {
  Monday: ClassRow[];
  Tuesday: ClassRow[];
  Wednesday: ClassRow[];
  Thursday: ClassRow[];
  Friday: ClassRow[];
};

router.get("/:student_id/classes/week", async (req: Request, res: Response) => {
  const { student_id } = req.params;
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

    rows.forEach((cls) => {
      // cls.day_of_week is strongly typed to the union above
      const day = cls.day_of_week as keyof Week;
      // push into the correct array
      week[day].push(cls);
    });

    res.json(week);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving class schedule" });
  }
});

router.get("/:student_id/attendance/semester", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    // 1. Load active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );

    if (semRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active semester found"
      });
    }

    const semester = semRows[0];

    // 2. Load ALL sessions in this semester that belong to classes the student is enrolled in
    const [sessionRows] = await db.query<any[]>(
      `
      SELECT 
        s.session_id,
        s.class_id,
        s.started_at,
        s.expires_at,
        s.online_mode,
        s.is_expired,

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

    // 3. Normalize status (if CI missing but expired → missed; if not expired → pending)
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
        student_status: status
      };
    });

    // 4. Build per-class summary (for analytics UI & lecturer UI)
    const summaryByClass: Record<number, any> = {};

    attendance.forEach((a) => {
      if (!summaryByClass[a.class_id]) {
        summaryByClass[a.class_id] = {
          class_id: a.class_id,
          class_name: a.class_name,
          course_code: a.course_code,
          total_sessions: 0,
          present_count: 0,
          missed_count: 0,
          latest_status: null
        };
      }

      const s = summaryByClass[a.class_id];
      s.total_sessions += 1;
      if (a.student_status === "present") s.present_count++;
      if (a.student_status === "missed") s.missed_count++;
      s.latest_status = a.student_status; // last entry = latest
    });

    return res.json({
      success: true,
      semester,
      attendance,
      summary_by_class: Object.values(summaryByClass)
    });

  } catch (err) {
    console.error("Error loading semester attendance:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load semester attendance"
    });
  }
});

router.get("/:student_id/active-sessions", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    // Return sessions for student's classes where session is not expired
    const [rows] = await db.query<any[]>(
      `
      SELECT s.session_id, s.class_id, s.started_at, s.expires_at, s.online_mode
      FROM Session s
      JOIN StudentClass sc ON sc.class_id = s.class_id
      WHERE sc.student_id = ?
        AND s.expires_at > NOW()
        AND (s.is_expired = 0 OR s.is_expired IS NULL)
      ORDER BY s.expires_at ASC
      `,
      [student_id]
    );

    // Normalize online_mode to boolean
    const sessions = rows.map((r) => ({
      session_id: r.session_id,
      class_id: r.class_id,
      started_at: r.started_at,
      scheduled_date: r.scheduled_date,
      expires_at: r.expires_at,
      online_mode: !!r.online_mode,
    }));

    return res.json({ success: true, sessions });
  } catch (err) {
    console.error("Error fetching active sessions:", err);
    return res.status(500).json({ success: false, message: "Error fetching active sessions" });
  }
});

router.post("/session-started", (req: Request, res: Response) => {
  const { class_id, started_at, expires_at } = req.body;

  io.emit("session_started", { class_id, started_at, expires_at });

  res.json({ message: "Event emitted" });
});

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula
 * @param lat1 - Latitude of first point (in degrees)
 * @param lon1 - Longitude of first point (in degrees)
 * @param lat2 - Latitude of second point (in degrees)
 * @param lon2 - Longitude of second point (in degrees)
 * @returns Distance in meters
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

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters

  return Math.round(distance); // Return distance rounded to nearest meter
}

// TypeScript interfaces for check-in
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

// POST /student/checkin - Check-in endpoint with geolocation validation
router.post("/checkin", async (req: Request, res: Response) => {
  const { student_id, session_id, latitude, longitude, accuracy } = req.body;

  // Validate required fields
  if (!student_id || !session_id) {
    return res.status(400).json({
      success: false,
      message: "student_id and session_id are required"
    });
  }

  // Validate geolocation data
  if (latitude === undefined || longitude === undefined || accuracy === undefined) {
    return res.status(400).json({
      success: false,
      message: "Geolocation data (latitude, longitude, accuracy) is required"
    });
  }

  try {
    // 1. Check if session exists and is still valid
    const [sessionRows] = await db.query<SessionRow[]>(
      `SELECT session_id, class_id, started_at, expires_at, online_mode, scheduled_date
       FROM Session
       WHERE session_id = ?`,
      [session_id]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    const session = sessionRows[0];

    // 2. Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Session has expired"
      });
    }

    // 3. Geolocation validation (skip if online_mode is enabled)
    if (session.online_mode === 0) {
      // Load campus coordinates from environment variables
      const campusLat = parseFloat(process.env.CAMPUS_LATITUDE || "0");
      const campusLng = parseFloat(process.env.CAMPUS_LONGITUDE || "0");
      const campusRadius = parseFloat(process.env.CAMPUS_RADIUS || "500");

      if (campusLat === 0 || campusLng === 0) {
        return res.status(500).json({
          success: false,
          message: "Campus location not configured"
        });
      }

      // Calculate distance between student and campus
      const distance = calculateDistance(latitude, longitude, campusLat, campusLng);

      console.log(`Check-in validation: Student at (${latitude}, ${longitude}), Campus at (${campusLat}, ${campusLng}), Distance: ${distance}m, Accuracy: ${accuracy}m, Allowed radius: ${campusRadius}m`);

      // Reject if student is outside campus radius
      if (distance > campusRadius) {
        return res.status(403).json({
          success: false,
          message: `You are too far from campus. Distance: ${distance}m (max: ${campusRadius}m)`
        });
      }

      // Warn if GPS accuracy is poor (but still allow check-in)
      if (accuracy > 100) {
        console.warn(`Warning: Poor GPS accuracy (${accuracy}m) for student ${student_id}`);
      }
    }

    // 4. Check if student is already checked in for this session
    const [existingCheckins] = await db.query<CheckinRow[]>(
      `SELECT checkin_id
       FROM Checkin
       WHERE session_id = ? AND student_id = ?`,
      [session_id, student_id]
    );

    if (existingCheckins.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Already checked in for this session"
      });
    }

    // 5. Insert check-in record with geolocation data
    const [result] = await db.query(
      `INSERT INTO Checkin (session_id, student_id, checkin_time, status, student_lat, student_lng, accuracy)
       VALUES (?, ?, NOW(), 'present', ?, ?, ?)`,
      [session_id, student_id, latitude, longitude, accuracy]
    );

    // 6. Emit Socket.IO event for real-time updates
    io.to(`class_${session.class_id}`).emit("studentCheckedIn", {
      class_id: session.class_id,
      session_id: session_id,
      student_id: student_id,
      checkin_time: new Date(),
      status: "present"
    });

    // 7. Return success response
    return res.status(200).json({
      success: true,
      message: "Check-in successful",
      data: {
        session_id: session_id,
        student_id: student_id,
        status: "present"
      }
    });

  } catch (error) {
    console.error("Check-in error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing check-in"
    });
  }
});

// Student analytics endpoint (Semester overview)
router.get("/:student_id/analytics", async (req: Request, res: Response) => {
  const { student_id } = req.params;

  try {
    // 1) Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );

    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester found" });
    }

    const semester = semRows[0];

    // 2) Get classes the student is enrolled in
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

    if (classRows.length === 0) {
      return res.json({
        success: true,
        semester,
        classes: [],
      });
    }

    const summaryResults: any[] = [];

    // 3) For each class → summarize attendance
    for (const cls of classRows) {
      const [sessions] = await db.query<any[]>(
        `
        SELECT s.session_id, s.started_at, s.is_expired
        FROM Session s
        WHERE s.class_id = ?
          AND s.started_at BETWEEN ? AND ?
        ORDER BY s.started_at ASC
        `,
        [cls.class_id, semester.start_date, semester.end_date]
      );

      let presentCount = 0;
      let missedCount = 0;

      for (const sess of sessions) {
        const [check] = await db.query<any[]>(
          `
          SELECT checkin_id
          FROM Checkin
          WHERE session_id = ?
            AND student_id = ?
          LIMIT 1
          `,
          [sess.session_id, student_id]
        );

        if (check.length > 0) presentCount++;
        else missedCount++;
      }

      const total = presentCount + missedCount;
      const rate = total === 0 ? 0 : Math.round((presentCount / total) * 100);

      let status: "good" | "warning" | "critical";
      if (rate >= 90) status = "good";
      else if (rate >= 80) status = "warning";
      else status = "critical";

      summaryResults.push({
        class_id: cls.class_id,
        class_name: cls.class_name,
        course_code: cls.course_code,
        lecturer_name: cls.lecturer_name,

        total_sessions: total,
        present_count: presentCount,
        missed_count: missedCount,

        attendance_rate: rate,
        attendance_status: status,
      });
    }

    return res.json({
      success: true,
      semester,
      classes: summaryResults
    });

  } catch (err) {
    console.error("Error fetching student analytics:", err);
    return res.status(500).json({ success: false, message: "Error loading student analytics" });
  }
});

// Student analytics endpoint (Per-class detailed)
router.get("/:student_id/analytics/class/:class_id", async (req: Request, res: Response) => {
  const { student_id, class_id } = req.params;

  try {
    // 1) Get active semester
    const [semRows] = await db.query<any[]>(
      `SELECT * FROM Semester WHERE status = 'active' LIMIT 1`
    );

    if (semRows.length === 0) {
      return res.status(404).json({ success: false, message: "No active semester found" });
    }

    const semester = semRows[0];

    // 2) Validate student enrollment in this class
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
      return res.status(403).json({
        success: false,
        message: "Student is not enrolled in this class"
      });
    }

    const classInfo = enrollmentRows[0];

    // 3) Get all sessions for this class in this semester
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

    let presentCount = 0;
    let missedCount = 0;
    const sessionDetails: any[] = [];

    // 4) Check attendance for each session
    for (const sess of sessions) {
      const [check] = await db.query<any[]>(
        `
        SELECT checkin_id
        FROM Checkin
        WHERE session_id = ?
          AND student_id = ?
        LIMIT 1
        `,
        [sess.session_id, student_id]
      );

      const isPresent = check.length > 0;

      if (isPresent) presentCount++;
      else missedCount++;

      sessionDetails.push({
        session_id: sess.session_id,
        started_at: sess.started_at,
        expires_at: sess.expires_at,
        online_mode: !!sess.online_mode,

        status: isPresent ? "present" : "missed"
      });
    }

    const totalSessions = presentCount + missedCount;
    const attendanceRate = totalSessions === 0
      ? 0
      : Math.round((presentCount / totalSessions) * 100);

    // 5) Status classification
    let status: "good" | "warning" | "critical";
    if (attendanceRate >= 90) status = "good";
    else if (attendanceRate >= 80) status = "warning";
    else status = "critical";

    // 6) Insights (optional but extremely useful)
    const WEEKS_TOTAL = 14; // from your semester data model
    const totalExpectedSessions = totalSessions; // based on sessions created so far
    const remainingSessions = 14 - sessionDetails.length;

    const projectedIfPerfect = Math.round(
      ((presentCount + remainingSessions) / (totalSessions + remainingSessions)) * 100
    );

    return res.json({
      success: true,
      semester,
      class: {
        ...classInfo,

        total_sessions: totalSessions,
        present_count: presentCount,
        missed_count: missedCount,
        attendance_rate: attendanceRate,
        attendance_status: status,

        sessions: sessionDetails,

        insights: {
          remaining_sessions: remainingSessions,
          projected_final_rate_if_attend_all_remaining: projectedIfPerfect,
          is_at_risk: attendanceRate < 80,
          is_warning: attendanceRate >= 80 && attendanceRate < 90
        }
      }
    });

  } catch (err) {
    console.error("Error fetching class analytics:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching class analytics"
    });
  }
});

export default router;