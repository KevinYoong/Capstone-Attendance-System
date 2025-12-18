import express, { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import db from "../../db";
import bcrypt from "bcrypt";

const router = express.Router();
const SALT_ROUNDS = 10;

// ============================================================================
//                                HELPER FUNCTIONS
// ============================================================================

/**
 * Validates if an ID is strictly an 8-digit string/number.
 * Used primarily for Student IDs (e.g., 21092127).
 */
function isValid8DigitId(id: string | number): boolean {
  const s = String(id);
  return /^\d{8}$/.test(s);
}

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type DayOfWeek = typeof VALID_DAYS[number];

const VALID_CLASS_TYPES = ["Lecture", "Tutorial"] as const;
type ClassType = typeof VALID_CLASS_TYPES[number];

function isValidDay(day: any): day is DayOfWeek {
  return VALID_DAYS.includes(day);
}

function isValidClassType(ct: any): ct is ClassType {
  return VALID_CLASS_TYPES.includes(ct);
}

// ============================================================================
//                            STUDENT MANAGEMENT
// ============================================================================

/**
 * GET /admin/students
 * Retrieves a paginated list of students with their enrolled class details.
 * * @query q - Search term (matches name, email, or student_id)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 50)
 * @query sortBy - Column to sort by (student_id, name, email)
 * @query order - Sort direction (asc/desc)
 */
router.get("/students", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "50", 10));
    const offset = (page - 1) * limit;

    const sortBy = (req.query.sortBy as string) || "student_id";
    const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";
    const validSorts = ["student_id", "name", "email"];
    const sortColumn = validSorts.includes(sortBy) ? `Student.${sortBy}` : "Student.student_id";

    // 1. Build Dynamic Search Query
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (q) {
      whereClauses.push(
        "(Student.name LIKE ? OR Student.email LIKE ? OR CAST(Student.student_id AS CHAR) LIKE ?)"
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 2. Fetch Students with Aggregated Class Data
    // Uses JSON_ARRAYAGG to pack enrolled classes into a single column for efficient fetching
    const listSql = `
      SELECT
        Student.student_id,
        Student.name,
        Student.email,
        COUNT(StudentClass.class_id) as classes_count,
        COALESCE(
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'class_id', Class.class_id,
              'class_name', Class.class_name,
              'course_code', Class.course_code
            )
          ),
          JSON_ARRAY()
        ) as classes_json
      FROM Student
      LEFT JOIN StudentClass ON Student.student_id = StudentClass.student_id
      LEFT JOIN Class ON StudentClass.class_id = Class.class_id
      ${whereSql}
      GROUP BY Student.student_id
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `;

    // 3. Count Total for Pagination
    const countSql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT Student.student_id
        FROM Student
        ${whereSql}
        GROUP BY Student.student_id
      ) AS t
    `;

    const listParams = [...params, limit, offset];
    const [rows] = await db.query<any[]>(listSql, listParams);
    const [countRows] = await db.query<any[]>(countSql, params);

    // 4. Parse JSON Results
    const students = rows.map((r) => {
      let classes = r.classes_json;
      if (typeof classes === 'string') {
        try { classes = JSON.parse(classes); } catch (e) { classes = []; }
      }
      
      // Remove null entries resulting from LEFT JOINs
      if (Array.isArray(classes)) {
        classes = classes.filter((c: any) => c && c.class_id);
      } else {
        classes = [];
      }

      return {
        student_id: String(r.student_id),
        name: r.name,
        email: r.email,
        classes_enrolled: Number(r.classes_count) || 0,
        classes: classes 
      };
    });

    const total = countRows[0]?.total ?? 0;

    res.json({ success: true, data: { students, total, page, limit } });
  } catch (err) {
    console.error("GET /admin/students error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * GET /admin/students/:id
 * Fetches a single student's profile.
 */
router.get("/students/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValid8DigitId(id)) {
      return res.status(400).json({ success: false, error: "student_id must be 8 digits" });
    }

    const sql = `
      SELECT
        Student.student_id,
        Student.name,
        Student.email,
        IFNULL(COUNT(StudentClass.student_id), 0) AS classes_enrolled
      FROM Student
      LEFT JOIN StudentClass ON Student.student_id = StudentClass.student_id
      WHERE Student.student_id = ?
      GROUP BY Student.student_id
      LIMIT 1
    `;
    const [rows] = await db.query<any[]>(sql, [Number(id)]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const r = rows[0];
    res.json({
      success: true,
      data: {
        student_id: String(r.student_id),
        name: r.name,
        email: r.email,
        classes_enrolled: Number(r.classes_enrolled) || 0,
      }
    });
  } catch (err) {
    console.error("GET /admin/students/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/students
 * Creates a new student account.
 * @body student_id - 8 digit ID
 * @body name, email, password
 */
router.post("/students", async (req: Request, res: Response) => {
  try {
    const { student_id, name, email, password } = req.body;

    if (!student_id || !name || !email || !password) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }

    if (!isValid8DigitId(student_id)) {
      return res.status(400).json({ success: false, error: "student_id must be exactly 8 digits" });
    }

    // Check duplicates
    const [idExists] = await db.query<any[]>("SELECT 1 FROM Student WHERE student_id = ? LIMIT 1", [Number(student_id)]);
    if (idExists.length > 0) return res.status(409).json({ success: false, error: "student_id already exists" });

    const [emailExists] = await db.query<any[]>("SELECT 1 FROM Student WHERE email = ? LIMIT 1", [email]);
    if (emailExists.length > 0) return res.status(409).json({ success: false, error: "email already in use" });

    // Hash & Insert
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    await db.query(
      `INSERT INTO Student (student_id, name, email, password) VALUES (?, ?, ?, ?)`,
      [Number(student_id), name, email, hashed]
    );

    res.status(201).json({
      success: true,
      data: { student_id: String(student_id), name, email, classes_enrolled: 0 }
    });
  } catch (err) {
    console.error("POST /admin/students error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/students/:id
 * Updates student details (Name, Email, Password).
 * Note: student_id cannot be changed here.
 */
router.put("/students/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValid8DigitId(id)) return res.status(400).json({ success: false, error: "Invalid student_id" });

    const { name, email, password } = req.body;

    // Check existence
    const [existingRows] = await db.query<any[]>("SELECT * FROM Student WHERE student_id = ? LIMIT 1", [Number(id)]);
    if (!existingRows.length) return res.status(404).json({ success: false, error: "Student not found" });
    const existing = existingRows[0];

    // Check email conflict
    if (email && email !== existing.email) {
      const [emailCheck] = await db.query<any[]>("SELECT 1 FROM Student WHERE email = ? AND student_id != ? LIMIT 1", [email, Number(id)]);
      if (emailCheck.length > 0) return res.status(409).json({ success: false, error: "Email already in use" });
    }

    // Dynamic Update
    const updates: string[] = [];
    const params: any[] = [];

    if (name) { updates.push("name = ?"); params.push(name); }
    if (email) { updates.push("email = ?"); params.push(email); }
    if (password) {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push("password = ?");
      params.push(hashed);
    }

    if (updates.length === 0) return res.json({ success: true, data: { message: "No changes detected" } });

    params.push(Number(id));
    await db.query(`UPDATE Student SET ${updates.join(", ")} WHERE student_id = ?`, params);

    res.json({ success: true, message: "Student updated successfully" });
  } catch (err) {
    console.error("PUT /admin/students/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/students/:id
 * Deletes a student and all their class enrollments using a transaction.
 */
router.delete("/students/:id", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const id = req.params.id;
    if (!isValid8DigitId(id)) return res.status(400).json({ success: false, error: "Invalid student_id" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [exists] = await conn.query<any[]>("SELECT 1 FROM Student WHERE student_id = ? LIMIT 1", [Number(id)]);
    if (!exists.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    // Delete dependencies first
    await conn.query("DELETE FROM StudentClass WHERE student_id = ?", [Number(id)]);
    await conn.query("DELETE FROM Student WHERE student_id = ?", [Number(id)]);

    await conn.commit();
    conn.release();

    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); conn.release(); } catch (e) {}
    }
    console.error("DELETE /admin/students/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/students/:id/reset-password
 * Admin override to reset a student's password.
 */
router.post("/students/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { password } = req.body;

    if (!isValid8DigitId(id)) return res.status(400).json({ success: false, error: "Invalid student_id" });
    if (!password) return res.status(400).json({ success: false, error: "Password is required" });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query<any>("UPDATE Student SET password = ? WHERE student_id = ?", [hashed, Number(id)]);

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: "Student not found" });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("POST /admin/students/:id/reset-password error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/students/:student_id/classes
 * Manually enroll a specific student into a specific class.
 */
router.post("/students/:student_id/classes", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;
    const { class_id } = req.body;

    if (!class_id) return res.status(400).json({ success: false, message: "Class ID is required" });

    // Check if already enrolled
    const [existing] = await db.query<any[]>(
      "SELECT * FROM StudentClass WHERE student_id = ? AND class_id = ?",
      [student_id, class_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Student is already enrolled in this class" });
    }

    await db.query(
      "INSERT INTO StudentClass (student_id, class_id) VALUES (?, ?)",
      [student_id, class_id]
    );

    // Return class details for UI update
    const [rows] = await db.query<any[]>(
      "SELECT class_id, class_name, course_code FROM Class WHERE class_id = ?",
      [class_id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Enroll error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/students/:student_id/classes/:class_id
 * Manually drop a student from a specific class.
 */
router.delete("/students/:student_id/classes/:class_id", async (req: Request, res: Response) => {
  try {
    const { student_id, class_id } = req.params;

    await db.query(
      "DELETE FROM StudentClass WHERE student_id = ? AND class_id = ?",
      [student_id, class_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /admin/students/:sid/classes/:cid:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================================================================
//                            LECTURER MANAGEMENT
// ============================================================================

/**
 * GET /admin/lecturers
 * Retrieves all lecturers with the list of classes they manage.
 */
router.get("/lecturers", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "50", 10));
    const offset = (page - 1) * limit;

    const sortBy = (req.query.sortBy as string) || "lecturer_id";
    const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";
    const validSorts = ["lecturer_id", "name", "email"];
    const sortColumn = validSorts.includes(sortBy) ? `Lecturer.${sortBy}` : "Lecturer.lecturer_id";

    const whereClauses: string[] = [];
    const params: any[] = [];
    if (q) {
      whereClauses.push("(Lecturer.name LIKE ? OR Lecturer.email LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Fetches Lecturers + Assigned Classes via JSON Aggregation
    const listSql = `
      SELECT
        Lecturer.lecturer_id,
        Lecturer.name,
        Lecturer.email,
        COUNT(Class.class_id) AS classes_count,
        COALESCE(
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'class_id', Class.class_id,
              'class_name', Class.class_name,
              'course_code', Class.course_code
            )
          ),
          JSON_ARRAY()
        ) as classes_json
      FROM Lecturer
      LEFT JOIN Class ON Lecturer.lecturer_id = Class.lecturer_id
      ${whereSql}
      GROUP BY Lecturer.lecturer_id
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) AS total FROM (SELECT Lecturer.lecturer_id FROM Lecturer ${whereSql}) AS t`;

    const [rows] = await db.query<any[]>(listSql, [...params, limit, offset]);
    const [countRows] = await db.query<any[]>(countSql, params);

    const lecturers = rows.map((r) => {
      let classes = r.classes_json;
      if (typeof classes === 'string') {
        try { classes = JSON.parse(classes); } catch (e) { classes = []; }
      }
      if (Array.isArray(classes)) {
        classes = classes.filter((c: any) => c && c.class_id);
      } else {
        classes = [];
      }

      return {
        lecturer_id: Number(r.lecturer_id),
        name: r.name,
        email: r.email,
        classes_assigned: classes,
        classes_count: Number(r.classes_count) || 0,
      };
    });

    const total = countRows[0]?.total ?? 0;
    res.json({ success: true, data: { lecturers, total, page, limit } });
  } catch (err) {
    console.error("GET /admin/lecturers error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/lecturers
 * Create new lecturer account.
 */
router.post("/lecturers", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: "All fields required" });

    // Check duplicate email
    const [emailRows] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE email = ? LIMIT 1", [email]);
    if (emailRows.length > 0) return res.status(409).json({ success: false, error: "Email already in use" });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query<any>("INSERT INTO Lecturer (name, email, password) VALUES (?, ?, ?)", [name, email, hashed]);

    res.status(201).json({
      success: true,
      data: { lecturer_id: result.insertId, name, email, classes_assigned: [] }
    });
  } catch (err) {
    console.error("POST /admin/lecturers error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/lecturers/:id
 * Update lecturer details.
 */
router.put("/lecturers/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, email, password } = req.body;

    const [exists] = await db.query<any[]>("SELECT * FROM Lecturer WHERE lecturer_id = ?", [id]);
    if (!exists.length) return res.status(404).json({ success: false, error: "Lecturer not found" });

    if (email && email !== exists[0].email) {
      const [check] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE email = ? AND lecturer_id != ?", [email, id]);
      if (check.length > 0) return res.status(409).json({ success: false, error: "Email already in use" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name) { updates.push("name = ?"); params.push(name); }
    if (email) { updates.push("email = ?"); params.push(email); }
    if (password) {
      updates.push("password = ?");
      params.push(await bcrypt.hash(password, SALT_ROUNDS));
    }

    if (!updates.length) return res.json({ success: true, message: "No changes" });

    params.push(id);
    await db.query(`UPDATE Lecturer SET ${updates.join(", ")} WHERE lecturer_id = ?`, params);

    res.json({ success: true, message: "Lecturer updated" });
  } catch (err) {
    console.error("PUT /admin/lecturers/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/lecturers/:id
 * Deletes a lecturer. Blocked if they still have classes assigned.
 */
router.delete("/lecturers/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    
    // Check if lecturer manages any classes
    const [classes] = await db.query<any[]>("SELECT class_id FROM Class WHERE lecturer_id = ? LIMIT 1", [id]);
    if (classes.length > 0) {
      return res.status(400).json({ success: false, error: "Cannot delete: Lecturer has assigned classes." });
    }

    const [result] = await db.query<any>("DELETE FROM Lecturer WHERE lecturer_id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: "Lecturer not found" });

    res.json({ success: true, message: "Lecturer deleted" });
  } catch (err) {
    console.error("DELETE /admin/lecturers/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/lecturers/:id/reset-password
 * Admin override for lecturer password.
 */
router.post("/lecturers/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body;

    if (!password) return res.status(400).json({ success: false, error: "Password required" });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query<any>("UPDATE Lecturer SET password = ? WHERE lecturer_id = ?", [hashed, id]);

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: "Lecturer not found" });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("POST /admin/lecturers/:id/reset-password error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================================================================
//                              CLASS MANAGEMENT
// ============================================================================

/**
 * GET /admin/classes
 * Retrieves classes with full details, including enrolled students.
 */
router.get("/classes", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "50", 10));
    const offset = (page - 1) * limit;

    const sortBy = (req.query.sortBy as string) || "class_id";
    const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";
    const validSorts = ["class_name", "course_code", "class_id"];
    const sortColumn = validSorts.includes(sortBy) ? `Class.${sortBy}` : "Class.class_id";

    const where: string[] = [];
    const params: any[] = [];
    
    if (q) {
      where.push("(Class.class_name LIKE ? OR Class.course_code LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const listSql = `
      SELECT
        Class.*,
        Lecturer.name AS lecturer_name,
        COALESCE(
          JSON_ARRAYAGG(
            IF(Student.student_id IS NOT NULL,
              JSON_OBJECT(
                'student_id', Student.student_id,
                'name', Student.name,
                'email', Student.email
              ),
              NULL
            )
          ),
          JSON_ARRAY()
        ) as students_json
      FROM Class
      LEFT JOIN Lecturer ON Class.lecturer_id = Lecturer.lecturer_id
      LEFT JOIN StudentClass ON Class.class_id = StudentClass.class_id
      LEFT JOIN Student ON StudentClass.student_id = Student.student_id
      ${whereSql}
      GROUP BY Class.class_id
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) AS total FROM (SELECT Class.class_id FROM Class ${whereSql}) AS t`;

    const [rows] = await db.query<any[]>(listSql, [...params, limit, offset]);
    const [countRows] = await db.query<any[]>(countSql, params);

    const classes = rows.map(r => {
      let students = r.students_json;
      if (typeof students === 'string') {
        try { students = JSON.parse(students); } catch(e) { students = []; }
      }
      if (Array.isArray(students)) {
        students = students.filter((s: any) => s && s.student_id);
      } else {
        students = [];
      }

      return {
        ...r,
        students_enrolled: students, 
      };
    });

    const total = countRows[0]?.total ?? 0;
    res.json({ success: true, data: { classes, total, page, limit } });
  } catch (err) {
    console.error("GET /admin/classes error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/classes
 * Creates a new class.
 * Validates day of week, class type, and academic weeks.
 */
router.post("/classes", async (req: Request, res: Response) => {
  try {
    const {
      class_name, course_code, time, location_lat, location_lng,
      day_of_week, start_time, end_time, class_type,
      lecturer_id, semester_id, start_week, end_week,
    } = req.body;

    if (!class_name || !course_code || !day_of_week || !start_time || !end_time || !class_type || !semester_id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (!isValidDay(day_of_week)) return res.status(400).json({ success: false, error: "Invalid day_of_week" });
    if (!isValidClassType(class_type)) return res.status(400).json({ success: false, error: "Invalid class_type" });

    // Validate Foreign Keys
    if (lecturer_id) {
      const [l] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE lecturer_id = ?", [lecturer_id]);
      if (!l.length) return res.status(400).json({ success: false, error: "Lecturer not found" });
    }
    const [s] = await db.query<any[]>("SELECT 1 FROM Semester WHERE semester_id = ?", [semester_id]);
    if (!s.length) return res.status(400).json({ success: false, error: "Semester not found" });

    const insertSql = `
      INSERT INTO Class
        (lecturer_id, class_name, course_code, time, location_lat, location_lng, day_of_week, start_time, end_time, class_type, semester_id, start_week, end_week)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query<any>(insertSql, [
      lecturer_id || null, class_name, course_code, time || null,
      location_lat || null, location_lng || null, day_of_week,
      start_time, end_time, class_type, semester_id,
      start_week || 1, end_week || 14
    ]);

    res.status(201).json({ success: true, data: { class_id: result.insertId } });
  } catch (err) {
    console.error("POST /admin/classes error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/classes/:id
 * Updates an existing class.
 */
router.put("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { class_name, course_code, start_time, end_time, lecturer_id, day_of_week, start_week, end_week } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (class_name) { updates.push("class_name = ?"); params.push(class_name); }
    if (course_code) { updates.push("course_code = ?"); params.push(course_code); }
    if (start_time) { updates.push("start_time = ?"); params.push(start_time); }
    if (end_time) { updates.push("end_time = ?"); params.push(end_time); }
    if (day_of_week) { updates.push("day_of_week = ?"); params.push(day_of_week); }
    if (start_week) { updates.push("start_week = ?"); params.push(start_week); }
    if (end_week) { updates.push("end_week = ?"); params.push(end_week); }
    if (lecturer_id !== undefined) { 
      updates.push("lecturer_id = ?"); 
      params.push(lecturer_id || null);
    }

    if (!updates.length) return res.json({ success: true, message: "No changes" });

    params.push(id);
    await db.query(`UPDATE Class SET ${updates.join(", ")} WHERE class_id = ?`, params);

    // Return the updated object
    const [row] = await db.query<any[]>("SELECT * FROM Class WHERE class_id = ?", [id]);
    res.json({ success: true, data: row[0] });
  } catch (err) {
    console.error("PUT /admin/classes/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/classes/:id
 * Deletes a class and removes all student enrollments for it.
 */
router.delete("/classes/:id", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const id = Number(req.params.id);
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1. Remove students from class
    await conn.query("DELETE FROM StudentClass WHERE class_id = ?", [id]);
    // 2. Delete class
    const [result] = await conn.query<any>("DELETE FROM Class WHERE class_id = ?", [id]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    await conn.commit();
    res.json({ success: true, message: "Class deleted" });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch(e) {}
    console.error("DELETE /admin/classes/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * POST /admin/classes/:id/students
 * Bulk enroll students into a class.
 * Used by the "Assign Students" modal.
 */
router.post("/classes/:id/students", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const classId = Number(req.params.id);
    const { student_ids } = req.body; // Array of IDs

    if (!Array.isArray(student_ids)) return res.status(400).json({ success: false, error: "student_ids array required" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    for (const sid of student_ids) {
      // Ignore duplicates if already enrolled
      const [exists] = await conn.query<any[]>(
        "SELECT 1 FROM StudentClass WHERE student_id = ? AND class_id = ?", 
        [sid, classId]
      );
      if (exists.length === 0) {
        await conn.query(
          "INSERT INTO StudentClass (student_id, class_id) VALUES (?, ?)", 
          [sid, classId]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Students assigned successfully" });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch(e) {}
    console.error("POST /admin/classes/:id/students error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * DELETE /admin/classes/:id/students/:student_id
 * Unenroll a student from a class.
 */
router.delete("/classes/:id/students/:student_id", async (req: Request, res: Response) => {
  try {
    const classId = Number(req.params.id);
    const studentId = req.params.student_id;

    await db.query(
      "DELETE FROM StudentClass WHERE class_id = ? AND student_id = ?",
      [classId, studentId]
    );

    res.json({ success: true, message: "Student removed from class" });
  } catch (err) {
    console.error("DELETE /admin/classes/:id/students/:sid error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================================================================
//                            SEMESTER MANAGEMENT
// ============================================================================

/**
 * GET /admin/semesters
 * List all semesters.
 */
router.get("/semesters", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query("SELECT * FROM Semester ORDER BY semester_id DESC");
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /admin/semesters error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/semesters
 * Create a new semester (defaults to inactive).
 */
router.post("/semesters", async (req: Request, res: Response) => {
  try {
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) return res.status(400).json({ success: false, error: "Missing fields" });

    await db.query(
      "INSERT INTO Semester (name, start_date, end_date, status) VALUES (?, ?, ?, 'inactive')",
      [name, start_date, end_date]
    );

    res.json({ success: true, message: "Semester created" });
  } catch (err) {
    console.error("POST /admin/semesters error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/semesters/:id
 * Update semester details.
 */
router.put("/semesters/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, start_date, end_date } = req.body;

    await db.query(
      "UPDATE Semester SET name = ?, start_date = ?, end_date = ? WHERE semester_id = ?",
      [name, start_date, end_date, id]
    );

    res.json({ success: true, message: "Semester updated" });
  } catch (err) {
    console.error("PUT /admin/semesters/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/semesters/:id
 * Deletes a semester.
 */
router.delete("/semesters/:id", async (req: Request, res: Response) => {
  try {
    await db.query("DELETE FROM Semester WHERE semester_id = ?", [req.params.id]);
    res.json({ success: true, message: "Semester deleted" });
  } catch (err) {
    console.error("DELETE /admin/semesters/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PATCH /admin/semesters/:id/activate
 * Sets the selected semester to 'active' and ALL others to 'inactive'.
 */
router.patch("/semesters/:id/activate", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1. Deactivate all
    await conn.query("UPDATE Semester SET status = 'inactive'");
    // 2. Activate selected
    await conn.query("UPDATE Semester SET status = 'active' WHERE semester_id = ?", [req.params.id]);

    await conn.commit();
    res.json({ success: true, message: "Semester activated" });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch(e) {}
    console.error("PATCH /admin/semesters/:id/activate error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

export default router;