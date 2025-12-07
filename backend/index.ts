import express, { Request, Response } from 'express';
import db from "./db";
import mysql, { RowDataPacket } from "mysql2/promise";
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import http from "http";          
import { Server } from "socket.io"; 
import studentRoutes from "./src/routes/studentRoutes";
import lecturerRoutes from "./src/routes/lecturerRoutes";
import semesterRoutes from "./src/routes/semesterRoutes";
import adminRoutes from "./src/routes/adminRoutes";
import { verifyAdmin } from "./src/middleware/verifyAdmin";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);
export const io: Server = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/student", studentRoutes);
app.use("/lecturer", lecturerRoutes);
app.use("/semester", semesterRoutes);
app.use("/admin", verifyAdmin, adminRoutes); 

// Handle socket connections
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // Student joins all class rooms they belong to
  socket.on("joinStudentRooms", async (studentId: number) => {
    try {
      const [rows] = await db.query<any[]>(
        `SELECT class_id FROM StudentClass WHERE student_id = ?`,
        [studentId]
      );

      rows.forEach((r) => {
        socket.join(`class_${r.class_id}`);
        console.log(`👨‍🎓 Student ${studentId} joined room class_${r.class_id}`);
      });
    } catch (err) {
      console.error("Error adding student to rooms:", err);
    }
  });

  // Lecturer joins a specific class room
  socket.on("joinLecturerRoom", (classId: number) => {
    socket.join(`class_${classId}`);
    console.log(`👨‍🏫 Lecturer joined room class_${classId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});


interface LoginRequestBody {
  identifier: string;
  password: string;
}

interface Student extends RowDataPacket {
  student_id: string;
  name: string;
  email: string;
  password: string;
  phone_number?: string;
  created_at: string;
}

interface Lecturer extends RowDataPacket {
  lecturer_id: number;
  name: string;
  email: string;
  password: string;
  phone_number?: string;
  created_at: string;
}

interface Admin extends RowDataPacket {
  admin_id: number;
  name: string;
  email: string;
  password: string;
}

type User = Student | Lecturer | Admin;

app.post("/create-admin", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO Admin (name, email, password) VALUES (?, ?, ?)",
    [name, email, hashed]
  );

  res.json({ success: true, message: "Admin created" });
});

app.post("/login", async (req: Request, res: Response) => {
  const { identifier, password } = req.body as LoginRequestBody;

  try {
    const isEmail = identifier.includes("@");
    let user: User | undefined;
    let role: "student" | "lecturer" | "admin" | undefined;

    // Admin login
    if (isEmail) {
      const [adminMatch] = await db.query<Admin[]>(
        "SELECT * FROM Admin WHERE email = ?",
        [identifier]
      );

      if (adminMatch.length > 0) {
        user = adminMatch[0];
        role = "admin";
      }
    }

    // Student login
    if (!user) {
      if (isEmail) {
        const [studentMatch] = await db.query<Student[]>(
          "SELECT * FROM Student WHERE email = ?",
          [identifier]
        );
        if (studentMatch.length > 0) {
          user = studentMatch[0];
          role = "student";
        }
      } else {
        const [studentMatch] = await db.query<Student[]>(
          "SELECT * FROM Student WHERE student_id = ?",
          [identifier]
        );
        if (studentMatch.length > 0) {
          user = studentMatch[0];
          role = "student";
        }
      }
    }

    // Lecturer login
    if (!user && isEmail) {
      const [lecturerMatch] = await db.query<Lecturer[]>(
        "SELECT * FROM Lecturer WHERE email = ?",
        [identifier]
      );
      if (lecturerMatch.length > 0) {
        user = lecturerMatch[0];
        role = "lecturer";
      }
    }

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // === ADMIN LOGIN WITH JWT ===
    if (role === "admin") {
      const token = jwt.sign(
        { id: (user as Admin).admin_id, role: "admin" },
        process.env.JWT_SECRET as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
      );

      return res.status(200).json({
        message: "Login successful.",
        user: {
          id: (user as Admin).admin_id,
          name: user.name,
          email: user.email,
          role,
        },
        token,
      });
    }

    // === NORMAL LOGIN FOR STUDENT / LECTURER ===
    return res.status(200).json({
      message: "Login successful.",
      user: {
        id:
          role === "student"
            ? (user as Student).student_id
            : (user as Lecturer).lecturer_id,
        name: user.name,
        email: user.email,
        role,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error", error: err });
  }
});

// Start the combined HTTP + Socket.IO server
server.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

/**
 * Background job to check for expired sessions and emit Socket.IO events
 * Runs every 15 seconds to detect sessions that have expired
 */
const SESSION_EXPIRY_CHECK_INTERVAL = 15000; // 15s
const processedExpiredSessions = new Set<number>();

setInterval(async () => {
  let conn: any = null;
  try {
    // 1) Find candidate sessions that expired and aren't marked expired
    const [expiredSessions] = await db.query<any[]>(
      `SELECT session_id, class_id, expires_at
       FROM Session
       WHERE expires_at < NOW() AND is_expired = 0
       ORDER BY expires_at DESC
       LIMIT 100`
    );

    if (!Array.isArray(expiredSessions) || expiredSessions.length === 0) {
      return;
    }

    for (const s of expiredSessions) {
      const sessionId = Number(s.session_id);
      const classId = Number(s.class_id);

      // Skip if another worker already processed it in-memory
      if (processedExpiredSessions.has(sessionId)) continue;

      // Use a connection so we can transactionally:
      // - mark session is_expired = 1
      // - insert missed checkins for students without a checkin for this session
      conn = await (db as any).getConnection(); // mysql2/promise pool connection
      await conn.beginTransaction();

      try {
        // Double-check in DB that session is still unexpired (race safe)
        const [checkSessionRows] = await conn.query(
          `SELECT is_expired FROM Session WHERE session_id = ? FOR UPDATE`,
          [sessionId]
        );
        
        const checkSession = checkSessionRows[0];

        if (!checkSession || checkSession.is_expired) {
          // already handled by another process; rollback and continue
          await conn.rollback();
          conn.release();
          conn = null;
          processedExpiredSessions.add(sessionId);
          continue;
        }

        // Mark session as expired
        await conn.query(
          `UPDATE Session SET is_expired = 1 WHERE session_id = ?`,
          [sessionId]
        );

        // Find all students in class who DO NOT have a checkin for this session
        // We'll insert a 'missed' checkin for each
        const [studentsWithoutCheckin] = await conn.query(
          `SELECT sc.student_id
          FROM StudentClass sc
          LEFT JOIN Checkin ci ON ci.session_id = ? AND ci.student_id = sc.student_id
          WHERE sc.class_id = ? AND ci.checkin_id IS NULL`,
          [sessionId, classId]
        );

        if (Array.isArray(studentsWithoutCheckin) && studentsWithoutCheckin.length > 0) {
          // Prepare bulk insert values
          const insertValues: any[] = [];
          const now = new Date();

          for (const r of studentsWithoutCheckin) {
            insertValues.push([sessionId, r.student_id, now, 'missed', null, null, null]);
            // format: session_id, student_id, checkin_time, status, student_lat, student_lng, accuracy
            // we leave lat/lng/accuracy NULL for missed entries
          }

          // Insert missed checkins in a single query
          await conn.query(
            `INSERT INTO Checkin (session_id, student_id, checkin_time, status, student_lat, student_lng, accuracy)
             VALUES ?`,
            [insertValues]
          );
        }

        // Commit the transaction
        await conn.commit();
        // Mark processed in-memory set to avoid reprocessing in this runtime
        processedExpiredSessions.add(sessionId);

        // Emit expiration event to the specific class room
        io.to(`class_${classId}`).emit("sessionExpired", {
          class_id: classId,
          session_id: sessionId,
          expired_at: s.expires_at,
        });

        console.log(`🔴 Session ${sessionId} (Class ${classId}) expired — marked + missed checkins inserted`);
      } catch (innerErr) {
        console.error("Error processing single expired session:", innerErr);
        try { if (conn) await conn.rollback(); } catch(e) {}
        if (conn) { conn.release(); conn = null; }
      } finally {
        if (conn) { conn.release(); conn = null; }
      }
    }

    // Cleanup processedExpiredSessions set:
    // Remove session_ids that are now > 2 hours old (best-effort)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const [oldSessions] = await db.query<any[]>(
      `SELECT session_id FROM Session WHERE expires_at < FROM_UNIXTIME(?)`,
      [Math.floor(twoHoursAgo / 1000)]
    );
    const oldSet = new Set(oldSessions.map((r) => r.session_id));
    for (const sid of Array.from(processedExpiredSessions)) {
      if (oldSet.has(sid)) processedExpiredSessions.delete(sid);
    }

  } catch (err) {
    console.error("❌ Error in session expiry background job:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
      try { conn.release(); } catch (e) {}
    }
  }
}, SESSION_EXPIRY_CHECK_INTERVAL);