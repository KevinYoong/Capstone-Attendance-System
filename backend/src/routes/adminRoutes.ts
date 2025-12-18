import express, { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import db from "../../db";
import bcrypt from "bcrypt";

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * Helper: validate 8-digit numeric student_id (string or number)
 */
function isValid8DigitId(id: string | number): boolean {
  const s = String(id);
  return /^\d{8}$/.test(s);
}

/**
 * GET /admin/students
 * Query params:
 * - q: search
 * - page, limit
 * - sortBy: 'student_id' | 'name' | 'email'
 * - order: 'asc' | 'desc'
 */
router.get("/students", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "50", 10));
    const offset = (page - 1) * limit;

    // Sorting params
    const sortBy = (req.query.sortBy as string) || "student_id";
    const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";

    const validSorts = ["student_id", "name", "email"];
    const sortColumn = validSorts.includes(sortBy) ? `Student.${sortBy}` : "Student.student_id";

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (q) {
      whereClauses.push(
        "(Student.name LIKE ? OR Student.email LIKE ? OR CAST(Student.student_id AS CHAR) LIKE ?)"
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // UPDATED QUERY: Joins Class table and aggregates results into a JSON array
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

    const countSql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT Student.student_id
        FROM Student
        ${whereSql}
        GROUP BY Student.student_id
      ) AS t
    `;

    const listParams = params.slice();
    listParams.push(limit, offset);

    const [rows] = await db.query<any[]>(listSql, listParams);
    const [countRows] = await db.query<any[]>(countSql, params);

    const students = rows.map((r) => {
      // Parse the JSON string from MySQL
      let classes = r.classes_json;
      if (typeof classes === 'string') {
        try { classes = JSON.parse(classes); } catch(e) { classes = []; }
      }
      
      // Filter out null entries (happens if a student has 0 classes due to LEFT JOIN)
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
        classes: classes // The frontend can now map this!
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
 * Returns single student, including classes_enrolled
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
    const student = {
      student_id: String(r.student_id),
      name: r.name,
      email: r.email,
      classes_enrolled: Number(r.classes_enrolled) || 0,
    };

    res.json({ success: true, data: student });
  } catch (err) {
    console.error("GET /admin/students/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/students
 * Create a new student.
 * Body: { student_id, name, email, password }
 *
 * Requirements:
 *  - student_id: exactly 8-digit numeric (string or number)
 *  - email: unique
 *  - password: required (admin must provide)
 */
router.post("/students", async (req: Request, res: Response) => {
  try {
    const { student_id, name, email, password } = req.body;

    if (!student_id || !name || !email || !password) {
      return res.status(400).json({ success: false, error: "student_id, name, email, password required" });
    }

    if (!isValid8DigitId(student_id)) {
      return res.status(400).json({ success: false, error: "student_id must be exactly 8 digits" });
    }

    // Check duplicate student_id
    const [idExistsRows] = await db.query<any[]>("SELECT 1 FROM Student WHERE student_id = ? LIMIT 1", [
      Number(student_id),
    ]);
    if (idExistsRows.length > 0) {
      return res.status(409).json({ success: false, error: "student_id already exists" });
    }

    // Check duplicate email
    const [emailExistsRows] = await db.query<any[]>("SELECT 1 FROM Student WHERE email = ? LIMIT 1", [email]);
    if (emailExistsRows.length > 0) {
      return res.status(409).json({ success: false, error: "email already in use" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const insertSql = `INSERT INTO Student (student_id, name, email, password) VALUES (?, ?, ?, ?)`;
    await db.query(insertSql, [Number(student_id), name, email, hashed]);

    const created = {
      student_id: String(student_id),
      name,
      email,
      classes_enrolled: 0,
    };

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error("POST /admin/students error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/students/:id
 * Update student details.
 * Body may include: { name, email, password }
 *
 * student_id in URL must be the 8-digit id and will NOT be changed here.
 */
router.put("/students/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValid8DigitId(id)) {
      return res.status(400).json({ success: false, error: "student_id must be 8 digits" });
    }

    const { name, email, password } = req.body;

    // Ensure student exists
    const [existingRows] = await db.query<any[]>("SELECT * FROM Student WHERE student_id = ? LIMIT 1", [Number(id)]);
    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }
    const existing = existingRows[0];

    // If email provided and different, check uniqueness
    if (email && email !== existing.email) {
      const [emailRows] = await db.query<any[]>("SELECT 1 FROM Student WHERE email = ? AND student_id != ? LIMIT 1", [
        email,
        Number(id),
      ]);
      if (emailRows.length > 0) {
        return res.status(409).json({ success: false, error: "email already in use" });
      }
    }

    // Build update dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (email) {
      updates.push("email = ?");
      params.push(email);
    }
    if (password) {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push("password = ?");
      params.push(hashed);
    }

    if (updates.length === 0) {
      // nothing to update
      return res.json({ success: true, data: { message: "No changes provided" } });
    }

    const updateSql = `UPDATE Student SET ${updates.join(", ")} WHERE student_id = ?`;
    params.push(Number(id));

    await db.query(updateSql, params);

    // Return updated record (with classes_enrolled)
    const retSql = `
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
    const [rows] = await db.query<any[]>(retSql, [Number(id)]);
    const r = rows[0];

    const student = {
      student_id: String(r.student_id),
      name: r.name,
      email: r.email,
      classes_enrolled: Number(r.classes_enrolled) || 0,
    };

    res.json({ success: true, data: student });
  } catch (err) {
    console.error("PUT /admin/students/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/students/:id
 * Deletes the student and any StudentClass assignments (transactional).
 */
router.delete("/students/:id", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const id = req.params.id;
    if (!isValid8DigitId(id)) {
      return res.status(400).json({ success: false, error: "student_id must be 8 digits" });
    }

    // Acquire a connection for transaction
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Ensure student exists
    const [existRows] = await conn.query<any[]>(
        "SELECT 1 FROM Student WHERE student_id = ? LIMIT 1", 
        [Number(id)])
    ;
    if (!existRows || existRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    // Delete student assignments
    await conn.query("DELETE FROM StudentClass WHERE student_id = ?", [Number(id)]);

    // Delete student
    await conn.query("DELETE FROM Student WHERE student_id = ?", [Number(id)]);

    await conn.commit();
    conn.release();

    res.json({ success: true, data: { message: "Student deleted" } });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
        conn.release();
      } catch (e) {
        console.error("Error rolling back:", e);
      }
    }
    console.error("DELETE /admin/students/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/students/:id/reset-password
 * Body: { password }
 * Admin resets student password
 */
router.post("/students/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { password } = req.body;

    if (!isValid8DigitId(id)) {
      return res.status(400).json({ success: false, error: "student_id must be 8 digits" });
    }

    if (!password) {
      return res.status(400).json({ success: false, error: "Password is required" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await db.query<any>(
      `UPDATE Student SET password = ? WHERE student_id = ?`,
      [hashed, Number(id)]
    );

    // MySQL driver returns OkPacket — check affected rows
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("POST /admin/students/:id/reset-password error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

const VALID_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"] as const;
type DayOfWeek = typeof VALID_DAYS[number];

const VALID_CLASS_TYPES = ["Lecture","Tutorial"] as const;
type ClassType = typeof VALID_CLASS_TYPES[number];

/* -----------------------------
   LECTURER CRUD
   ----------------------------- */

/**
 * GET /admin/lecturers
 * - q: search by name/email
 * - page, limit
 * - sortBy: 'name' | 'email' | 'lecturer_id'
 * - order: 'asc' | 'desc'
 * Response: { success: true, data: { lecturers: [...], total, page, limit } }
 */
router.get("/lecturers", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "50", 10));
    const offset = (page - 1) * limit;

    // Sorting Params (Matches what we added to Frontend)
    const sortBy = (req.query.sortBy as string) || "lecturer_id";
    const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";

    // Validate sort column
    const validSorts = ["lecturer_id", "name", "email"];
    const sortColumn = validSorts.includes(sortBy) ? `Lecturer.${sortBy}` : "Lecturer.lecturer_id";

    const whereClauses: string[] = [];
    const params: any[] = [];
    if (q) {
      whereClauses.push("(Lecturer.name LIKE ? OR Lecturer.email LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // UPDATED SQL: Uses JSON_ARRAYAGG to get the list of classes
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

    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT Lecturer.lecturer_id FROM Lecturer
        ${whereSql}
      ) AS t
    `;

    const listParams = params.slice();
    listParams.push(limit, offset);

    const [rows] = await db.query<any[]>(listSql, listParams);
    const [countRows] = await db.query<any[]>(countSql, params);

    const lecturers = rows.map((r) => {
      // Parse the JSON string from MySQL
      let classes = r.classes_json;
      if (typeof classes === 'string') {
        try { classes = JSON.parse(classes); } catch(e) { classes = []; }
      }
      
      // Filter out nulls (caused by LEFT JOIN on lecturers with 0 classes)
      if (Array.isArray(classes)) {
        classes = classes.filter((c: any) => c && c.class_id);
      } else {
        classes = [];
      }

      return {
        lecturer_id: Number(r.lecturer_id),
        name: r.name,
        email: r.email,
        classes_assigned: classes, // Now populated!
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
 * GET /admin/lecturers/:id
 * Returns lecturer details + classes assigned (full list)
 */
router.get("/lecturers/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "Invalid lecturer_id" });

    const [lRows] = await db.query<any[]>("SELECT lecturer_id, name, email FROM Lecturer WHERE lecturer_id = ? LIMIT 1", [id]);
    if (!lRows || lRows.length === 0) return res.status(404).json({ success: false, error: "Lecturer not found" });

    const lecturer = lRows[0];

    const [classRows] = await db.query<any[]>(
      `SELECT class_id, class_name, course_code, day_of_week, start_time, end_time, class_type, semester_id
       FROM Class WHERE lecturer_id = ? ORDER BY class_id DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        lecturer_id: lecturer.lecturer_id,
        name: lecturer.name,
        email: lecturer.email,
        classes_assigned: classRows || [],
      },
    });
  } catch (err) {
    console.error("GET /admin/lecturers/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/lecturers
 * Body: { name, email, password }
 */
router.post("/lecturers", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "name, email and password are required" });
    }

    // email uniqueness
    const [emailRows] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE email = ? LIMIT 1", [email]);
    if (emailRows.length > 0) return res.status(409).json({ success: false, error: "email already in use" });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const insertSql = `INSERT INTO Lecturer (name, email, password) VALUES (?, ?, ?)`;
    const [result] = await db.query<any>(insertSql, [name, email, hashed]);

    // result.insertId is the new lecturer_id
    res.status(201).json({
      success: true,
      data: {
        lecturer_id: result.insertId,
        name,
        email,
        classes_assigned: [],
      },
    });
  } catch (err) {
    console.error("POST /admin/lecturers error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/lecturers/:id
 * Body may include: { name, email, password }
 */
router.put("/lecturers/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "Invalid lecturer_id" });

    const { name, email, password } = req.body;

    // ensure exists
    const [existRows] = await db.query<any[]>("SELECT * FROM Lecturer WHERE lecturer_id = ? LIMIT 1", [id]);
    if (!existRows || existRows.length === 0) return res.status(404).json({ success: false, error: "Lecturer not found" });
    const existing = existRows[0];

    if (email && email !== existing.email) {
      const [emailCheck] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE email = ? AND lecturer_id != ? LIMIT 1", [email, id]);
      if (emailCheck.length > 0) return res.status(409).json({ success: false, error: "email already in use" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name) { updates.push("name = ?"); params.push(name); }
    if (email) { updates.push("email = ?"); params.push(email); }
    if (password) {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push("password = ?");
      params.push(hashed);
    }

    if (updates.length === 0) return res.json({ success: true, data: { message: "No changes provided" } });

    const updateSql = `UPDATE Lecturer SET ${updates.join(", ")} WHERE lecturer_id = ?`;
    params.push(id);
    await db.query(updateSql, params);

    // return updated lecturer
    const [row] = await db.query<any[]>("SELECT lecturer_id, name, email FROM Lecturer WHERE lecturer_id = ? LIMIT 1", [id]);
    res.json({ success: true, data: row[0] });
  } catch (err) {
    console.error("PUT /admin/lecturers/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/lecturers/:id
 * Prevent deletion if lecturer has classes assigned.
 */
router.delete("/lecturers/:id", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "Invalid lecturer_id" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [existRows] = await conn.query<any[]>("SELECT 1 FROM Lecturer WHERE lecturer_id = ? LIMIT 1", [id]);
    if (!existRows || existRows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: "Lecturer not found" });
    }

    const [classRows] = await conn.query<any[]>("SELECT class_id FROM Class WHERE lecturer_id = ? LIMIT 1", [id]);
    if (classRows.length > 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, error: "Lecturer has classes assigned. Reassign or delete classes first." });
    }

    await conn.query("DELETE FROM Lecturer WHERE lecturer_id = ?", [id]);
    await conn.commit(); conn.release();

    res.json({ success: true, data: { message: "Lecturer deleted" } });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); conn.release(); } catch(e){ console.error("rollback err", e); }
    }
    console.error("DELETE /admin/lecturers/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/lecturers/:id/reset-password
 * Body: { password }
 * Admin resets lecturer password
 */
router.post("/lecturers/:id/reset-password", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: "Invalid lecturer_id" });
    }

    if (!password) {
      return res.status(400).json({ success: false, error: "Password is required" });
    }

    // Ensure lecturer exists
    const [existRows] = await db.query<any[]>(
      "SELECT lecturer_id FROM Lecturer WHERE lecturer_id = ? LIMIT 1",
      [id]
    );
    if (!existRows || existRows.length === 0) {
      return res.status(404).json({ success: false, error: "Lecturer not found" });
    }

    // Hash new password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Update in database
    await db.query(
      "UPDATE Lecturer SET password = ? WHERE lecturer_id = ?",
      [hashed, id]
    );

    return res.json({
      success: true,
      message: "Lecturer password updated successfully",
    });
  } catch (err) {
    console.error("POST /admin/lecturers/:id/reset-password error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* -----------------------------
   CLASS CRUD
   ----------------------------- */

/**
 * Helper: validate day_of_week and class_type
 */
function isValidDay(day: any): day is DayOfWeek {
  return VALID_DAYS.includes(day);
}
function isValidClassType(ct: any): ct is ClassType {
  return VALID_CLASS_TYPES.includes(ct);
}

/**
 * GET /admin/classes
 * - q: search by class_name or course_code
 * - page, limit
 * - sortBy: 'class_name' | 'course_code' | 'class_id'
 * - order: 'asc' | 'desc'
 */
router.get("/classes", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.max(1, parseInt((req.query.limit as string) || "50", 10));
    const offset = (page - 1) * limit;

    // Sorting Params
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

    // UPDATED SQL: Fetches enrolled students list via JSON aggregation
    const listSql = `
      SELECT
        Class.class_id,
        Class.class_name,
        Class.course_code,
        Class.day_of_week,
        Class.start_time,
        Class.end_time,
        Class.class_type,
        Class.lecturer_id,
        Class.semester_id,
        Class.start_week,
        Class.end_week,
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

    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT Class.class_id FROM Class
        ${whereSql}
      ) AS t
    `;

    const listParams = params.slice();
    listParams.push(limit, offset);

    const [rows] = await db.query<any[]>(listSql, listParams);
    const [countRows] = await db.query<any[]>(countSql, params);

    const classes = rows.map(r => {
      // Parse JSON students list
      let students = r.students_json;
      if (typeof students === 'string') {
        try { students = JSON.parse(students); } catch(e) { students = []; }
      }
      // Filter out nulls (from LEFT JOIN with no matches)
      if (Array.isArray(students)) {
        students = students.filter((s: any) => s && s.student_id);
      } else {
        students = [];
      }

      return {
        class_id: Number(r.class_id),
        class_name: r.class_name,
        course_code: r.course_code,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        class_type: r.class_type,
        lecturer_id: r.lecturer_id ? Number(r.lecturer_id) : null,
        lecturer_name: r.lecturer_name || null,
        semester_id: Number(r.semester_id),
        start_week: Number(r.start_week),
        end_week: Number(r.end_week),
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
 * GET /admin/classes/:id
 */
router.get("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "Invalid class_id" });

    const [rows] = await db.query<any[]>(
      `SELECT
        Class.*,
        Lecturer.name AS lecturer_name,
        IFNULL(COUNT(StudentClass.student_id), 0) AS enrolled_count
       FROM Class
       LEFT JOIN Lecturer ON Class.lecturer_id = Lecturer.lecturer_id
       LEFT JOIN StudentClass ON Class.class_id = StudentClass.class_id
       WHERE Class.class_id = ?
       GROUP BY Class.class_id
       LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: "Class not found" });

    const r = rows[0];
    res.json({
      success: true,
      data: {
        class_id: Number(r.class_id),
        class_name: r.class_name,
        course_code: r.course_code,
        time: r.time,
        location_lat: r.location_lat,
        location_lng: r.location_lng,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        class_type: r.class_type,
        lecturer_id: r.lecturer_id ? Number(r.lecturer_id) : null,
        lecturer_name: r.lecturer_name || null,
        semester_id: Number(r.semester_id),
        start_week: Number(r.start_week),
        end_week: Number(r.end_week),
        enrolled_count: Number(r.enrolled_count) || 0,
      }
    });
  } catch (err) {
    console.error("GET /admin/classes/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/classes
 * Body: required fields: class_name, course_code, day_of_week, start_time, end_time, class_type, semester_id, start_week, end_week
 * Optional: lecturer_id, time, location_lat, location_lng
 */
router.post("/classes", async (req: Request, res: Response) => {
  try {
    const {
      class_name,
      course_code,
      time,
      location_lat,
      location_lng,
      day_of_week,
      start_time,
      end_time,
      class_type,
      lecturer_id,
      semester_id,
      start_week,
      end_week,
    } = req.body;

    // required validation
    if (!class_name || !course_code || !day_of_week || !start_time || !end_time || !class_type || !semester_id || start_week == null || end_week == null) {
      return res.status(400).json({ success: false, error: "Missing required class fields" });
    }

    if (!isValidDay(day_of_week)) return res.status(400).json({ success: false, error: "Invalid day_of_week" });
    if (!isValidClassType(class_type)) return res.status(400).json({ success: false, error: "Invalid class_type" });

    const sWeek = Number(start_week);
    const eWeek = Number(end_week);
    if (!Number.isInteger(sWeek) || !Number.isInteger(eWeek) || sWeek < 1 || eWeek < sWeek) {
      return res.status(400).json({ success: false, error: "Invalid start_week/end_week" });
    }

    // If lecturer_id provided, ensure lecturer exists
    if (lecturer_id != null) {
      const [lecRows] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE lecturer_id = ? LIMIT 1", [Number(lecturer_id)]);
      if (lecRows.length === 0) return res.status(400).json({ success: false, error: "Lecturer not found" });
    }

    // If semester_id provided, ensure semester exists
    const [semRows] = await db.query<any[]>("SELECT 1 FROM Semester WHERE semester_id = ? LIMIT 1", [Number(semester_id)]);
    if (semRows.length === 0) return res.status(400).json({ success: false, error: "Semester not found" });

    const insertSql = `
      INSERT INTO Class
        (lecturer_id, class_name, course_code, time, location_lat, location_lng, day_of_week, start_time, end_time, class_type, semester_id, start_week, end_week)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      lecturer_id ? Number(lecturer_id) : null,
      class_name,
      course_code,
      time || null,
      location_lat != null ? Number(location_lat) : null,
      location_lng != null ? Number(location_lng) : null,
      day_of_week,
      start_time,
      end_time,
      class_type,
      Number(semester_id),
      sWeek,
      eWeek,
    ];

    const [result] = await db.query<any>(insertSql, params);
    res.status(201).json({
      success: true,
      data: {
        class_id: result.insertId,
        ...req.body,
      },
    });
  } catch (err) {
    console.error("POST /admin/classes error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/classes/:id
 * Update class fields. Validate weeks, lecturer, semester as in POST.
 */
router.put("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "Invalid class_id" });

    // Ensure class exists
    const [existRows] = await db.query<any[]>("SELECT * FROM Class WHERE class_id = ? LIMIT 1", [id]);
    if (!existRows || existRows.length === 0) return res.status(404).json({ success: false, error: "Class not found" });

    const {
      class_name,
      course_code,
      time,
      location_lat,
      location_lng,
      day_of_week,
      start_time,
      end_time,
      class_type,
      lecturer_id,
      semester_id,
      start_week,
      end_week,
    } = req.body;

    // Validation
    if (day_of_week && !isValidDay(day_of_week)) return res.status(400).json({ success: false, error: "Invalid day_of_week" });
    if (class_type && !isValidClassType(class_type)) return res.status(400).json({ success: false, error: "Invalid class_type" });
    if ((start_week != null || end_week != null)) {
      const sWeek = start_week != null ? Number(start_week) : existRows[0].start_week;
      const eWeek = end_week != null ? Number(end_week) : existRows[0].end_week;
      if (!Number.isInteger(sWeek) || !Number.isInteger(eWeek) || sWeek < 1 || eWeek < sWeek) {
        return res.status(400).json({ success: false, error: "Invalid start_week/end_week" });
      }
    }

    if (lecturer_id != null) {
      const [lecRows] = await db.query<any[]>("SELECT 1 FROM Lecturer WHERE lecturer_id = ? LIMIT 1", [Number(lecturer_id)]);
      if (lecRows.length === 0) return res.status(400).json({ success: false, error: "Lecturer not found" });
    }

    if (semester_id != null) {
      const [semRows] = await db.query<any[]>("SELECT 1 FROM Semester WHERE semester_id = ? LIMIT 1", [Number(semester_id)]);
      if (semRows.length === 0) return res.status(400).json({ success: false, error: "Semester not found" });
    }

    // Build update
    const updates: string[] = [];
    const params: any[] = [];
    if (class_name) { updates.push("class_name = ?"); params.push(class_name); }
    if (course_code) { updates.push("course_code = ?"); params.push(course_code); }
    if (time !== undefined) { updates.push("time = ?"); params.push(time); }
    if (location_lat !== undefined) { updates.push("location_lat = ?"); params.push(location_lat != null ? Number(location_lat) : null); }
    if (location_lng !== undefined) { updates.push("location_lng = ?"); params.push(location_lng != null ? Number(location_lng) : null); }
    if (day_of_week) { updates.push("day_of_week = ?"); params.push(day_of_week); }
    if (start_time) { updates.push("start_time = ?"); params.push(start_time); }
    if (end_time) { updates.push("end_time = ?"); params.push(end_time); }
    if (class_type) { updates.push("class_type = ?"); params.push(class_type); }
    if (lecturer_id !== undefined) { updates.push("lecturer_id = ?"); params.push(lecturer_id != null ? Number(lecturer_id) : null); }
    if (semester_id !== undefined) { updates.push("semester_id = ?"); params.push(semester_id != null ? Number(semester_id) : null); }
    if (start_week !== undefined) { updates.push("start_week = ?"); params.push(Number(start_week)); }
    if (end_week !== undefined) { updates.push("end_week = ?"); params.push(Number(end_week)); }

    if (updates.length === 0) return res.json({ success: true, data: { message: "No changes provided" } });

    const updateSql = `UPDATE Class SET ${updates.join(", ")} WHERE class_id = ?`;
    params.push(id);
    await db.query(updateSql, params);

    // Return updated row
    const [rows] = await db.query<any[]>("SELECT * FROM Class WHERE class_id = ? LIMIT 1", [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("PUT /admin/classes/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/classes/:id
 * Transactional: delete StudentClass rows first, then Class row.
 */
router.delete("/classes/:id", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "Invalid class_id" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [existRows] = await conn.query<any[]>("SELECT 1 FROM Class WHERE class_id = ? LIMIT 1", [id]);
    if (!existRows || existRows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    await conn.query("DELETE FROM StudentClass WHERE class_id = ?", [id]);
    await conn.query("DELETE FROM Class WHERE class_id = ?", [id]);

    await conn.commit(); conn.release();
    res.json({ success: true, data: { message: "Class deleted" } });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); conn.release(); } catch(e) { console.error("rollback err", e); }
    }
    console.error("DELETE /admin/classes/:id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* -----------------------------
   StudentClass assignment routes
   ----------------------------- */

/**
 * POST /admin/classes/:id/students
 * Body: { student_ids: [ "21092127", "21092128", ... ] }
 * Bulk-add students to class (ignores duplicates)
 */
router.post("/classes/:id/students", async (req: Request, res: Response) => {
  let conn: PoolConnection | null = null;
  try {
    const classId = Number(req.params.id);
    if (!Number.isInteger(classId)) return res.status(400).json({ success: false, error: "Invalid class_id" });

    const student_ids: (string|number)[] = req.body.student_ids;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: "student_ids array required" });
    }

    // Validate class exists
    const [classRows] = await db.query<any[]>("SELECT 1 FROM Class WHERE class_id = ? LIMIT 1", [classId]);
    if (classRows.length === 0) return res.status(404).json({ success: false, error: "Class not found" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const added: string[] = [];
    const skipped: string[] = [];

    for (const sidRaw of student_ids) {
      const sidStr = String(sidRaw);
      if (!isValid8DigitId(sidStr)) {
        skipped.push(sidStr);
        continue;
      }
      const sid = Number(sidStr);

      // ensure student exists
      const [sRows] = await conn.query<any[]>("SELECT 1 FROM Student WHERE student_id = ? LIMIT 1", [sid]);
      if (sRows.length === 0) { skipped.push(sidStr); continue; }

      // avoid duplicates
      const [enRows] = await conn.query<any[]>("SELECT 1 FROM StudentClass WHERE student_id = ? AND class_id = ? LIMIT 1", [sid, classId]);
      if (enRows.length > 0) { skipped.push(sidStr); continue; }

      await conn.query("INSERT INTO StudentClass (student_id, class_id, joined_at) VALUES (?, ?, CURRENT_TIMESTAMP())", [sid, classId]);
      added.push(sidStr);
    }

    await conn.commit(); conn.release();
    res.json({ success: true, data: { added, skipped } });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); conn.release(); } catch(e) { console.error("rollback err", e); }
    }
    console.error("POST /admin/classes/:id/students error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/classes/:id/students/:student_id
 * Remove a student from a class
 */
router.delete("/classes/:id/students/:student_id", async (req: Request, res: Response) => {
  try {
    const classId = Number(req.params.id);
    const studentIdRaw = req.params.student_id;
    if (!Number.isInteger(classId)) return res.status(400).json({ success: false, error: "Invalid class_id" });
    if (!isValid8DigitId(studentIdRaw)) return res.status(400).json({ success: false, error: "Invalid student_id" });

    const sid = Number(studentIdRaw);

    // ensure enrollment exists
    const [enRows] = await db.query<any[]>("SELECT 1 FROM StudentClass WHERE student_id = ? AND class_id = ? LIMIT 1", [sid, classId]);
    if (enRows.length === 0) return res.status(404).json({ success: false, error: "Enrollment not found" });

    await db.query("DELETE FROM StudentClass WHERE student_id = ? AND class_id = ?", [sid, classId]);
    res.json({ success: true, data: { message: "Student removed from class" } });
  } catch (err) {
    console.error("DELETE /admin/classes/:id/students/:student_id error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* -----------------------------
   SEMESTER ADMIN ROUTES
   ----------------------------- */

import { calculateCurrentWeek } from "../utils/semesterUtils";

/**
 * GET /admin/semesters
 * Returns all semesters (admin view)
 */
router.get("/semesters", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query(
      `SELECT
        semester_id,
        name,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
       FROM Semester
       ORDER BY semester_id DESC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /admin/semesters:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/semesters
 * Body: { name, start_date, end_date }
 */
router.post("/semesters", async (req: Request, res: Response) => {
  try {
    const { name, start_date, end_date } = req.body;

    if (!name || !start_date || !end_date) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    await db.query(
      `INSERT INTO Semester (name, start_date, end_date, status)
       VALUES (?, ?, ?, 'inactive')`,
      [name, start_date, end_date]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("POST /admin/semesters:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PUT /admin/semesters/:id
 * Update semester name or dates
 */
router.put("/semesters/:id", async (req: Request, res: Response) => {
  try {
    const { name, start_date, end_date } = req.body;
    const id = req.params.id;

    await db.query(
      `UPDATE Semester
         SET name = ?, start_date = ?, end_date = ?
       WHERE semester_id = ?`,
      [name, start_date, end_date, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("PUT /admin/semesters/:id:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/semesters/:id
 */
router.delete("/semesters/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await db.query(`DELETE FROM Semester WHERE semester_id = ?`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /admin/semesters/:id:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * PATCH /admin/semesters/:id/activate
 * Sets all semesters to inactive, then activates the selected semester
 */
router.patch("/semesters/:id/activate", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await db.query(`UPDATE Semester SET status = 'inactive'`);
    await db.query(`UPDATE Semester SET status = 'active' WHERE semester_id = ?`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /admin/semesters/:id/activate:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * POST /admin/students/:student_id/classes
 * Enroll a specific student into a specific class
 */
router.post("/students/:student_id/classes", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;
    const { class_id } = req.body;

    if (!class_id) {
      return res.status(400).json({ success: false, message: "Class ID is required" });
    }

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

    // Fetch class details to return to frontend for immediate UI update
    const [rows] = await db.query<any[]>(
      "SELECT class_id, class_name, course_code FROM Class WHERE class_id = ?",
      [class_id]
    );
    const classInfo = rows[0];

    res.json({ success: true, data: classInfo });
  } catch (err) {
    console.error("Enroll error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * DELETE /admin/students/:student_id/classes/:class_id
 * Drop a student from a specific class
 */
router.delete("/students/:student_id/classes/:class_id", async (req: Request, res: Response) => {
  try {
    const { student_id, class_id } = req.params;

    await db.query(
      `DELETE FROM StudentClass WHERE student_id = ? AND class_id = ?`,
      [student_id, class_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /admin/students/:sid/classes/:cid:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;