import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";

const router = Router();

interface ClassRow extends RowDataPacket {
  class_id: number;
  class_name: string;
  course_code: string;
  day_of_week: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  start_time: string;
  end_time: string;
  class_type: "Lecture" | "Tutorial";
}

type Week = {
  Monday: ClassRow[];
  Tuesday: ClassRow[];
  Wednesday: ClassRow[];
  Thursday: ClassRow[];
  Friday: ClassRow[];
};

router.get("/:lecturer_id/classes/week", async (req: Request, res: Response) => {
  const { lecturer_id } = req.params;

  try {
    const [rows] = await db.query<ClassRow[]>(
      `
      SELECT 
        class_id,
        class_name,
        course_code,
        day_of_week,
        start_time,
        end_time,
        class_type
      FROM Class
      WHERE lecturer_id = ?
      ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time;
      `,
      [lecturer_id]
    );

    const week: Week = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };

    rows.forEach((cls) => {
      week[cls.day_of_week].push(cls);
    });

    res.json(week);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving lecturer schedule" });
  }
});

export default router;
