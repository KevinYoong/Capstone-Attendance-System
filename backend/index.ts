import express, { Request, Response } from 'express';
import db from "./db";
import mysql, { RowDataPacket } from "mysql2/promise";
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from "bcrypt";
import http from "http";          
import { Server } from "socket.io"; 
import studentRoutes from "./src/routes/studentRoutes";
import lecturerRoutes from "./src/routes/lecturerRoutes";
import semesterRoutes from "./src/routes/semesterRoutes";

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

type User = Student | Lecturer;

app.post("/login", async (req: Request, res: Response) => {
  const { identifier, password } = req.body as LoginRequestBody;

  try {
    const isEmail = identifier.includes("@");
    let user: User | undefined;
    let role: 'student' | 'lecturer' | undefined;

    if (isEmail) {
      const [studentMatch] = await db.query<(Student & RowDataPacket)[]>(
        "SELECT * FROM Student WHERE email = ?",
        [identifier]
      );

      if (studentMatch.length > 0) {
        user = studentMatch[0];
        role = "student";
      } else {
        const [lecturerMatch] = await db.query<(Lecturer & RowDataPacket)[]>(
          "SELECT * FROM Lecturer WHERE email = ?",
          [identifier]
        );
        if (lecturerMatch.length > 0) {
          user = lecturerMatch[0];
          role = "lecturer";
        }
      }
    } else {
      const [studentMatch] = await db.query<(Student & RowDataPacket)[]>(
        "SELECT * FROM Student WHERE student_id = ?",
        [identifier]
      );

      if (studentMatch.length > 0) {
        user = studentMatch[0];
        role = "student";
      }
    }

    if (!user) return res.status(401).json({ message: "User not found." });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ message: "Incorrect password." });

    res.status(200).json({
      message: "Login successful.",
      user: {
        id: role === "student" ? (user as Student).student_id : (user as Lecturer).lecturer_id,
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