# Attendance System - Deployment & Setup Guide

This project is a Geolocation-based Attendance System built with a React frontend and a Node.js/Express backend. Follow these steps to set up the environment and run the application.

---

## 1. Database Setup (MySQL)
1. Open **MySQL Workbench**.
2. Run the provided `database_schema.sql` (or `attendance_system.sql`) script to create the database structure.
3. Ensure the `Admin` table has at least one account. You can use the `/create-admin` endpoint or run:
   ```sql
   INSERT INTO Admin (name, email, password) VALUES ('Admin', 'admin@sunway.edu.my', '$2b$10$YourHashedPasswordHere');

## 2. Backend Configuration (Server)
1. Open the /server folder in your terminal.
2. Install dependencies: npm install
3. Create a .env file in the root of the /server directory and add the following:
   PORT=3001
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=attendance_system
   JWT_SECRET=supersecretkey123
   JWT_EXPIRES_IN=1d
5. Start the backend application: npm run dev

## 3. Frontend Configuration (Client)
1. Open the root folder (or /client) in a new terminal.
2. Install dependencies: npm install
3. Start the frontend application: npm run dev

## 4. Initial Login Credentials
Once both the frontend and backend are running, you can access the system at http://localhost:5173 (or the port provided by Vite):
- Admin Login: Use the email and password created in Step 1.
- Lecturer/Student Login: Use the credentials added via the Admin Dashboard.
