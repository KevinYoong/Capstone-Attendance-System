import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { calculateCurrentWeek } from "../utils/semesterUtils";

const router = Router();

// TypeScript interface for Semester
// Note: MySQL returns BOOLEAN as TINYINT (0 or 1)
interface SemesterRow extends RowDataPacket {
  semester_id: number;
  name: string;
  start_date: string;
  end_date: string;
  current_week: number;
  is_sem_break: number; // MySQL BOOLEAN returns 0 or 1
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}

/**
 * GET /semester/current
 * Returns the currently active semester with week information
 */
router.get("/current", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query<SemesterRow[]>(
      `SELECT
        semester_id,
        name,
        start_date,
        end_date,
        current_week,
        is_sem_break,
        status,
        created_at,
        updated_at
       FROM Semester
       WHERE status = 'active'
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active semester found"
      });
    }

    const semester = rows[0];

    // Calculate current week from dates (automatic)
    const weekInfo = calculateCurrentWeek(semester.start_date);

    const semesterData = {
      semester_id: semester.semester_id,
      name: semester.name,
      start_date: semester.start_date,
      end_date: semester.end_date,
      current_week: weekInfo.current_week, // Calculated from dates
      is_sem_break: weekInfo.is_sem_break, // Calculated from dates
      status: semester.status
    };

    return res.status(200).json({
      success: true,
      data: semesterData
    });

  } catch (error) {
    console.error("Error fetching current semester:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving semester information"
    });
  }
});

/**
 * GET /semester/:semester_id
 * Get a specific semester by ID
 */
router.get("/:semester_id", async (req: Request, res: Response) => {
  const { semester_id } = req.params;

  try {
    const [rows] = await db.query<SemesterRow[]>(
      `SELECT
        semester_id,
        name,
        start_date,
        end_date,
        current_week,
        is_sem_break,
        status
       FROM Semester
       WHERE semester_id = ?`,
      [semester_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Semester not found"
      });
    }

    const semester = rows[0];

    // Calculate current week from dates (automatic)
    const weekInfo = calculateCurrentWeek(semester.start_date);

    const semesterData = {
      semester_id: semester.semester_id,
      name: semester.name,
      start_date: semester.start_date,
      end_date: semester.end_date,
      current_week: weekInfo.current_week, // Calculated from dates
      is_sem_break: weekInfo.is_sem_break, // Calculated from dates
      status: semester.status
    };

    return res.status(200).json({
      success: true,
      data: semesterData
    });

  } catch (error) {
    console.error("Error fetching semester:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving semester information"
    });
  }
});

export default router;