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

  try {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 2 * 60000);

    const [result] = await db.query(
      `INSERT INTO Session (class_id, started_at, expires_at, online_mode) VALUES (?, ?, ?, ?)`,
      [class_id, startedAt, expiresAt, true]
    );

    const session_id = (result as any).insertId;

    // Notify all connected clients (students) that a check-in has been activated
    io.emit("checkinActivated", { class_id, session_id, startedAt, expiresAt });

    res.status(201).json({
      message: "Check-in activated",
      session_id,
      started_at: startedAt,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error activating check-in" });
  }
});

export default router;