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
app.use("/admin", verifyAdmin, adminRoutes); // JWT-protected admin routes

// Handle socket connections
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

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

app.post("/login", async (req: Request, res: Response) => {
  const { identifier, password } = req.body as LoginRequestBody;

  try {
    const isEmail = identifier.includes("@");
    let user: User | undefined;
    let role: "student" | "lecturer" | "admin" | undefined;

    // Check Admin table first (email only)
    if (isEmail) {
      const [adminRows] = await db.query<Admin[]>(
        "SELECT * FROM Admin WHERE email = ?",
        [identifier]
      );

      if (adminRows.length > 0) {
        user = adminRows[0];
        role = "admin";
      }
    }

    // Check Student table
    if (!user) {
      if (isEmail) {
        const [studentRows] = await db.query<Student[]>(
          "SELECT * FROM Student WHERE email = ?",
          [identifier]
        );
        if (studentRows.length > 0) {
          user = studentRows[0];
          role = "student";
        }
      } else {
        // Student ID login
        const [studentRows] = await db.query<Student[]>(
          "SELECT * FROM Student WHERE student_id = ?",
          [identifier]
        );
        if (studentRows.length > 0) {
          user = studentRows[0];
          role = "student";
        }
      }
    }

    // Check Lecturer table (email only)
    if (!user && isEmail) {
      const [lecturerRows] = await db.query<Lecturer[]>(
        "SELECT * FROM Lecturer WHERE email = ?",
        [identifier]
      );
      if (lecturerRows.length > 0) {
        user = lecturerRows[0];
        role = "lecturer";
      }
    }

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // Admin login: generate JWT token
    if (role === "admin") {
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        console.error("JWT_SECRET not configured in environment variables");
        return res.status(500).json({
          message: "Server configuration error"
        });
      }

      const token = jwt.sign(
        {
          id: (user as Admin).admin_id,
          role: "admin"
        },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      return res.status(200).json({
        message: "Login successful.",
        user: {
          id: (user as Admin).admin_id,
          name: user.name,
          email: user.email,
          role: "admin",
        },
        token,
      });
    }

    // Student/Lecturer login: no token
    res.status(200).json({
      message: "Login successful.",
      user: {
        id: role === "student"
          ? (user as Student).student_id
          : (user as Lecturer).lecturer_id,
        name: user.name,
        email: user.email,
        role,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Start the combined HTTP + Socket.IO server
server.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});