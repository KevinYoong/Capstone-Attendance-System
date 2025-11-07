// backend/routes/studentRoutes.ts
import { Router, Request, Response } from "express";
import db from "../../db";
import { RowDataPacket } from "mysql2/promise";

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

const EMPTY_WEEK: Week = {
  Monday: [],
  Tuesday: [],
  Wednesday: [],
  Thursday: [],
  Friday: [],
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

    // Copy empty week (so we don't modify shared object)
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

export default router;