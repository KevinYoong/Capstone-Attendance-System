import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";
import { calculateCurrentWeek } from "../utils/semesterUtils";

const router = Router();

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

/**
 * Represents a Semester row from the database.
 * Note: MySQL returns BOOLEAN columns as TINYINT (0 or 1).
 */
interface SemesterRow extends RowDataPacket {
  semester_id: number;
  name: string;
  start_date: string;
  end_date: string;
  current_week: number;
  is_sem_break: number; // 0 = false, 1 = true
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
//                                SEMESTER ROUTES
// ============================================================================

/**
 * GET /semester/current
 * Retrieves the currently active semester.
 * * * Features:
 * - Fetches the single semester marked as 'active'.
 * - Dynamically calculates the 'current_week' based on today's date vs start_date.
 * - Determines if the semester is currently on a break.
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

    // Calculate current week dynamically based on start_date
    const weekInfo = calculateCurrentWeek(semester.start_date);

    return res.json({
      success: true,
      data: {
        ...semester,
        current_week: weekInfo.current_week,
        is_sem_break: weekInfo.is_sem_break
      }
    });
  } catch (err) {
    console.error("Error fetching current semester:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching semester information"
    });
  }
});

/**
 * GET /semester/:semester_id
 * Retrieves details for a specific semester by ID.
 * * * Usage:
 * - Used by admin panels or history views to see details of past/future semesters.
 * - Also performs dynamic week calculation for consistency.
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
      current_week: weekInfo.current_week, 
      is_sem_break: weekInfo.is_sem_break, 
      status: semester.status
    };

    return res.json({
      success: true,
      data: semesterData
    });
  } catch (err) {
    console.error("Error fetching semester details:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching semester details"
    });
  }
});

export default router;