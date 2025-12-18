import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Initialize environment variables from .env file
dotenv.config();

/**
 * Database Connection Pool
 * * Uses 'mysql2/promise' for async/await support.
 * * Creates a reusable pool of connections to avoid overhead of 
 * opening/closing connections for every single request.
 */
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "attendance_system",
  waitForConnections: true,
  connectionLimit: 10,  // Max concurrent connections
  queueLimit: 0         // Unlimited queueing
});

// Test the connection on startup
db.getConnection()
  .then((conn) => {
    console.log("✅ [Database] Successfully connected to MySQL");
    conn.release(); // Always release the connection back to the pool
  })
  .catch((err) => {
    console.error("❌ [Database] Connection failed:", err.message);
  });

export default db;