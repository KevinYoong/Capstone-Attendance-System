// backend/routes/studentRoutes.ts
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

router.post("/session-started", (req: Request, res: Response) => {
  const { class_id, started_at, expires_at } = req.body;

  io.emit("session_started", { class_id, started_at, expires_at });

  res.json({ message: "Event emitted" });
});

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

// POST /student/checkin - Basic check-in endpoint (no geolocation yet)
router.post("/checkin", async (req: Request, res: Response) => {
  const { student_id, session_id } = req.body;

  // Validate required fields
  if (!student_id || !session_id) {
    return res.status(400).json({
      success: false,
      message: "student_id and session_id are required"
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

    // 3. Check if student is already checked in for this session
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

    // 4. Insert check-in record
    const [result] = await db.query(
      `INSERT INTO Checkin (session_id, student_id, checkin_time, status)
       VALUES (?, ?, NOW(), 'present')`,
      [session_id, student_id]
    );

    // 5. Emit Socket.IO event for real-time updates
    io.emit("studentCheckedIn", {
      class_id: session.class_id,
      session_id: session_id,
      student_id: student_id,
      checkin_time: new Date(),
      status: "present"
    });

    // 6. Return success response
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