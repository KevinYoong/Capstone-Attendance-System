import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { io } from "../../index";
import { calculateCurrentWeek } from "../utils/semesterUtils";

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
  semester_id: number;
  start_week: number;
  end_week: number;
}

interface SemesterRow extends RowDataPacket {
  semester_id: number;
  name: string;
  start_date: string;
}

// Week record type
type Week = {
  Monday: ClassRow[];
  Tuesday: ClassRow[];
  Wednesday: ClassRow[];
  Thursday: ClassRow[];
  Friday: ClassRow[];
};

/**
 * GET /student/:student_id/classes/week?week=X
 * Get student's weekly class schedule for a specific week
 * Query params:
 *   - week (optional): Week number (1-14). Defaults to current semester week.
 */
router.get("/:student_id/classes/week", async (req: Request, res: Response) => {
  const { student_id } = req.params;
  const weekParam = req.query.week as string | undefined;

  try {
    // 1. Get active semester info
    const [semesterRows] = await db.query<SemesterRow[]>(
      `SELECT semester_id, name, start_date
       FROM Semester
       WHERE status = 'active'
       LIMIT 1`
    );

    if (semesterRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active semester found"
      });
    }

    const semester = semesterRows[0];

    // Calculate current week from dates (automatic)
    const weekInfo = calculateCurrentWeek(semester.start_date);
    const requestedWeek = weekParam ? parseInt(weekParam) : weekInfo.current_week;

    // Validate week number
    if (requestedWeek < 1 || requestedWeek > 14) {
      return res.status(400).json({
        success: false,
        message: "Week must be between 1 and 14"
      });
    }

    // 2. Check if the requested week is during semester break
    // Sem break occurs between weeks 7 and 8 (calculated from dates)
    const isSemBreak = weekInfo.is_sem_break;

    // 3. Fetch classes for the student (filtered by semester and week range)
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
        Class.semester_id,
        Class.start_week,
        Class.end_week,
        Lecturer.name AS lecturer_name
      FROM StudentClass
      JOIN Class ON StudentClass.class_id = Class.class_id
      JOIN Lecturer ON Class.lecturer_id = Lecturer.lecturer_id
      WHERE StudentClass.student_id = ?
        AND Class.semester_id = ?
        AND Class.start_week <= ?
        AND Class.end_week >= ?
      ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time;
    `,
      [student_id, semester.semester_id, requestedWeek, requestedWeek]
    );

    const week: Week = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };

    // If it's semester break, return empty schedule with metadata
    if (!isSemBreak) {
      rows.forEach((cls) => {
        const day = cls.day_of_week as keyof Week;
        week[day].push(cls);
      });
    }

    // Return schedule with metadata
    res.json({
      success: true,
      semester: {
        semester_id: semester.semester_id,
        name: semester.name,
        current_week: weekInfo.current_week, // Calculated from dates
        is_sem_break: weekInfo.is_sem_break // Calculated from dates
      },
      week_number: requestedWeek,
      is_viewing_sem_break: isSemBreak,
      schedule: week
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error retrieving class schedule"
    });
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
      `SELECT session_id, class_id, started_at, expires_at, online_mode
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
    io.emit("studentCheckedIn", {
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

export default router;