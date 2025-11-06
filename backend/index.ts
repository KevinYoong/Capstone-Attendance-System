import express, { Request, Response } from 'express';
import mysql, { RowDataPacket } from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from "bcrypt";

interface LoginRequestBody {
  identifier: string; // can be email or student_id
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

// Load the environment variables from .env
dotenv.config();

// Set up Express app and port
const app = express();
const port = process.env.PORT || 3001;

// Set up middleware
app.use(cors()); // Allows your frontend to make requests
app.use(express.json()); // Allows server to read JSON data

// Create the connection pool to the database
const db: mysql.Pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.post("/login", async (req: Request, res: Response) => {
  const { identifier, password } = req.body as LoginRequestBody;

  try {
    const isEmail = identifier.includes("@");
    let user: User | undefined;
    let role: 'student' | 'lecturer' | undefined;

    if (isEmail) {
      // Email → check Student first, then Lecturer
      const [studentMatch] = await db.query<Student[]>(
        "SELECT * FROM Student WHERE email = ?",
        [identifier]
      );

      if (studentMatch.length > 0) {
        user = studentMatch[0];
        role = "student";
      } else {
        const [lecturerMatch] = await db.query<Lecturer[]>(
          "SELECT * FROM Lecturer WHERE email = ?",
          [identifier]
        );
        if (lecturerMatch.length > 0) {
          user = lecturerMatch[0];
          role = "lecturer";
        }
      }
    } else {
      // No '@' → treat as Student ID ONLY (Lecturers cannot use numeric ID to login)
      const [studentMatch] = await db.query<Student[]>(
        "SELECT * FROM Student WHERE student_id = ?",
        [identifier]
      );

      if (studentMatch.length > 0) {
        user = studentMatch[0];
        role = "student"; // student confirmed
      }
    }

    // If nothing matched
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    // Verify password hash
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // Success → return user info (no password!)
    res.status(200).json({
      message: "Login successful.",
      user: {
        id: role === "student" ? user.student_id : user.lecturer_id,
        name: user.name,
        email: user.email,
        role: role,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Create a test route to check database connection
app.get('/test_db', async (req: Request, res: Response) => {
  try {
    const [results] = await db.query<mysql.RowDataPacket[]>('SELECT 1');
    res.status(200).json({ 
      message: 'Database connection successful!', 
      data: results 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Database connection failed.', 
      error: err 
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});