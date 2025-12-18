import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { RowDataPacket } from "mysql2";

// Database Connection
import db from "./db";

// Route Imports
import studentRoutes from "./src/routes/studentRoutes";
import lecturerRoutes from "./src/routes/lecturerRoutes";
import semesterRoutes from "./src/routes/semesterRoutes";
import adminRoutes from "./src/routes/adminRoutes";

// Middleware
import { verifyAdmin } from "./src/middleware/verifyAdmin";

// Configuration
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
//                            SERVER & SOCKET SETUP
// ============================================================================

const server = http.createServer(app);

export const io: Server = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// ============================================================================
//                            API ROUTES
// ============================================================================

app.use("/student", studentRoutes);
app.use("/lecturer", lecturerRoutes);
app.use("/semester", semesterRoutes);
// Protect Admin routes with middleware
app.use("/admin", verifyAdmin, adminRoutes);

// ============================================================================
//                            SOCKET.IO HANDLERS
// ============================================================================

io.on("connection", (socket) => {
  console.log("🟢 [Socket] Client connected:", socket.id);

  // Student joins all class rooms they belong to
  socket.on("joinStudentRooms", async (studentId: number) => {
    console.log(`📥 [Socket] joinStudentRooms received for Student ${studentId}`);
    try {
      const [rows] = await db.query<any[]>(
        `SELECT class_id FROM StudentClass WHERE student_id = ?`,
        [studentId]
      );

      if (rows.length === 0) {
        console.warn(`⚠️ [Socket] Student ${studentId} has NO classes!`);
      }

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
    console.log("🔴 [Socket] Client disconnected:", socket.id);
  });
});

// ============================================================================
//                            AUTH TYPES
// ============================================================================

interface LoginRequestBody {
  identifier: string;
  password: string;
}

interface Student extends RowDataPacket {
  student_id: string;
  name: string;
  email: string;
  password: string;
  created_at: string;
}

interface Lecturer extends RowDataPacket {
  lecturer_id: number;
  name: string;
  email: string;
  password: string;
  created_at: string;
}

interface Admin extends RowDataPacket {
  admin_id: number;
  name: string;
  email: string;
  password: string;
}

type User = Student | Lecturer | Admin;

// ============================================================================
//                            AUTH ENDPOINTS
// ============================================================================

/**
 * POST /create-admin
 * Helper route to create the initial admin account.
 */
app.post("/create-admin", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO Admin (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed]
    );

    res.json({ success: true, message: "Admin created successfully" });
  } catch (err) {
    console.error("Create Admin Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /login
 * Handles login for Admin, Lecturer, and Student based on identifier (ID or Email).
 */
app.post("/login", async (req: Request, res: Response) => {
  const { identifier, password } = req.body as LoginRequestBody;

  try {
    const isEmail = identifier.includes("@");
    let user: User | undefined;
    let role: "student" | "lecturer" | "admin" | undefined;

    // 1. Check Admin (Email only)
    if (isEmail) {
      const [adminMatch] = await db.query<Admin[]>(
        "SELECT * FROM Admin WHERE email = ? LIMIT 1",
        [identifier]
      );

      if (adminMatch.length > 0) {
        user = adminMatch[0];
        role = "admin";
      }
    }

    // 2. Check Student (ID or Email)
    if (!user) {
      const query = isEmail 
        ? "SELECT * FROM Student WHERE email = ? LIMIT 1" 
        : "SELECT * FROM Student WHERE student_id = ? LIMIT 1";
      
      const [studentMatch] = await db.query<Student[]>(query, [identifier]);
      
      if (studentMatch.length > 0) {
        user = studentMatch[0];
        role = "student";
      }
    }

    // 3. Check Lecturer (Email only)
    if (!user && isEmail) {
      const [lecturerMatch] = await db.query<Lecturer[]>(
        "SELECT * FROM Lecturer WHERE email = ? LIMIT 1",
        [identifier]
      );
      if (lecturerMatch.length > 0) {
        user = lecturerMatch[0];
        role = "lecturer";
      }
    }

    // 4. Validate User Found
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    // 5. Validate Password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // 6. Generate JWT Token
    const payload = { 
      id: role === 'admin' 
          ? (user as Admin).admin_id 
          : role === 'student' 
            ? (user as Student).student_id 
            : (user as Lecturer).lecturer_id,
      role: role 
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" } as jwt.SignOptions
    );

    // 7. Return Response
    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: payload.id,
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

// ============================================================================
//                       BACKGROUND TASKS (AUTO-EXPIRY)
// ============================================================================

/**
 * Interval Job: Runs every 10 seconds.
 * 1. Finds sessions that have expired but are not yet marked.
 * 2. Marks absentees as 'missed'.
 * 3. Updates session status to 'is_expired = 1'.
 * 4. Notifies clients via Socket.IO.
 */
setInterval(async () => {
  let conn: any = null;

  try {
    conn = await (db as any).getConnection();
    await conn.beginTransaction();

    // 1. Load sessions that have expired but not processed
    const [expiredSessions] = await conn.query(
      `SELECT session_id, class_id, started_at
       FROM Session
       WHERE expires_at < NOW() AND is_expired = 0
       FOR UPDATE`
    );

    if (expiredSessions.length === 0) {
      await conn.rollback();
      conn.release();
      return;
    }

    for (const session of expiredSessions) {
      const { session_id, class_id, started_at } = session;

      // 2. Insert "missed" check-ins for absent students
      await conn.query(
        `INSERT INTO Checkin (session_id, student_id, checkin_time, status)
         SELECT ?, sc.student_id, NULL, 'missed'
         FROM StudentClass sc
         LEFT JOIN Checkin ci ON ci.session_id = ? AND ci.student_id = sc.student_id
         WHERE sc.class_id = ?
           AND sc.joined_at <= ?
           AND ci.checkin_id IS NULL`,
        [session_id, session_id, class_id, started_at]
      );

      // 3. Mark session as expired
      await conn.query(
        `UPDATE Session SET is_expired = 1 WHERE session_id = ?`,
        [session_id]
      );

      // 4. Emit Socket.IO event
      io.to(`class_${class_id}`).emit("sessionExpired", {
        class_id,
        session_id
      });
      
      console.log(`⏰ [Scheduler] Session ${session_id} expired. Absentees marked.`);
    }

    await conn.commit();
    conn.release();
  } catch (err) {
    console.error("Auto-expire job error:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) {}
      try { conn.release(); } catch (e) {}
    }
  }
}, 10_000);

// ============================================================================
//                            SERVER START
// ============================================================================

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});