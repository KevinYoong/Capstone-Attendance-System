1. 🚀 Project Overview
This is a full-stack attendance tracking system with Students, Lecturers, and Admins, featuring:
- Weekly class schedules
- Real-time check-in sessions using Socket.IO
- Geolocation check-in validation
- Semester + Week navigation with semester break support
- Admin portal (UI complete, backend next)
- Class, student, lecturer management
- Upcoming analytics, QR check-in, and JWT auth

2. 🎯 Current Progress (Phase-by-Phase)
✅ Phase 1 — Core Check-in Flow
- Socket.IO real-time server
- Lecturer activates session
- Students receive live activation
- Real-time class status updates

✅ Phase 2 — Geolocation Verification
- Haversine formula
- GPS accuracy
- Campus radius validation
- Online mode bypass option

✅ Phase 3 — Semester System
- Semester table
- Automatic week calculation
- Week 1–7 → Break → Week 8–14
- Frontend week navigation
- Filtering classes by week
- Empty schedule during break

✅ Phase 4 — Admin Portal (Frontend)
Admin UI is complete for:
- Sidebar (collapsible)
- Students page (search, pagination, edit, delete, reset password modal)
- Lecturers page (search, pagination, edit, delete, reset password modal)
- Classes page (create, edit inline, delete, assign lecturer, manage week ranges)
⚠️ Admin pages currently use mock data — backend CRUD not implemented yet.

🔜 Phase 5 — Admin Backend CRUD (NEXT)
Estimated Time: 5-7 days
Tasks:
    CRUD Students
        Create student (form: name, email, student_id, password)
        Edit student (update details)
        Delete student (with confirmation)
        View all students (table with search/filter)
    CRUD Lecturers
        Create lecturer (form: name, email, password)
        Edit lecturer
        Delete lecturer
        View all lecturers (table)
    CRUD Classes
        Create class (name, course_code, day, time, type, lecturer, semester, weeks)
        Edit class (reassign lecturer, change schedule)
        Delete class
        View all classes (table, filter by semester)
    Assign Students to Classes
        View class details page
        See enrolled students (table)
        Add students (multi-select dropdown)
        Remove students from class

New Routes:
    Students: GET/POST/PUT/DELETE /admin/students
    Lecturers: GET/POST/PUT/DELETE /admin/lecturers
    Classes: GET/POST/PUT/DELETE /admin/classes
    Assignments: POST/DELETE /admin/classes/:id/students

🚧 Phase 6: Auto Session Expiry (NOT STARTED)
Estimated Time: 1-2 days
Tasks:
    Backend: Background job to check expired sessions
    Socket.IO: Emit 'sessionExpired' event when session expires
    Frontend: StudentDashboard listens for sessionExpired
    Frontend: Update UI (yellow → red) when session expires
    Integration testing

New Features:
    Automatic session expiry detection (no page refresh)
    Visual feedback when time runs out

🚧 Phase 7: Attendance Analytics (NOT STARTED)
Estimated Time: 3-4 days
Tasks:
    Lecturer Analytics
        View attendance history by class
        Filter by week/date range
        Export to CSV
        Show attendance percentage per class

    Student Analytics
        View personal attendance percentage (per class)
        Show missed classes
        Attendance streak tracker
        Weekly attendance summary

New Routes:
    GET /lecturer/:id/analytics
    GET /student/:id/analytics
    GET /lecturer/:id/classes/:class_id/attendance?week=X

4. Folder Structure 
backend/
  index.ts              # Server, /login, Socket.IO
  db.ts                 # MySQL pool
  src/routes/
    studentRoutes.ts
    lecturerRoutes.ts
    semesterRoutes.ts
    adminRoutes.ts      # Placeholder (CRUD coming next)
  src/utils/
    semesterUtils.ts

frontend/
  src/context/AuthContext.tsx     # Student/Lecturer/Admin
  src/App.tsx                     # Routing with role protection
  src/components/
    ProtectedRoute.tsx
    LoginForm.tsx
    AdminSidebar.tsx
  src/pages/
    LoginPage.tsx
    StudentDashboard.tsx
    LecturerDashboard.tsx
    LecturerClassDetail.tsx
    admin/
      AdminDashboard.tsx
      AdminStudents.tsx
      AdminLecturers.tsx
      AdminClasses.tsx
      AdminSemesters.tsx

5. 🔐 Roles & Authentication Rules
Student
- Login: ID or email
- Role: "student"
- Dashboard: /student

Lecturer
- Login: email only
- Role: "lecturer"
- Dashboard: /lecturer

Admin
- Login: email only
- Role: "admin"
- Dashboard: /admin
- Full CRUD access

All stored in:
AuthContext.tsx → user.role = "student" | "lecturer" | "admin"

6. Database Schema (Key Fields)
Student
(student_id PK, name, email, password, phone_number)

Lecturer
(lecturer_id PK, name, email, password)

Class
(class_id PK, name, code, day_of_week, start_time, end_time, class_type, lecturer_id, semester_id, start_week, end_week)

StudentClass
(student_id, class_id)

Session
(session_id PK, class_id, started_at, expires_at, online_mode)

Checkin
(checkin_id PK, session_id, student_id, student_lat, student_lng, accuracy, status)

Admin
(admin_id, name, email, password)


7. 🔌 Key Backend Endpoints
/login
Handles student/lecturer/admin:
- Detects email or student ID
- bcrypt.compare
- Returns { id, name, email, role }

/student/...
Weekly schedule, check-in endpoint (implemented).

/lecturer/...
Weekly schedule, class detail, activate check-in.

/semester/current
Returns active semester + current week.

/admin/...
⚠️ CRUD endpoints NOT IMPLEMENTED YET → next task.


8. Rules for Any AI Working on This Repo
- Do NOT rewrite entire files unless necessary.
- Changes must be compatible with existing frontend structure, especially Typescript interfaces.
- Backend responses must follow this format:
   - { "success": true, "data": ... }
- Never store raw passwords. Always bcrypt.hash().
- All class filtering must respect semester week + break.
- All admin CRUD must update all dependent tables (e.g., deleting student removes them from StudentClass).
- Use parameterized SQL queries (no raw string interpolation).
- Frontend must use React Hooks + TailwindCSS consistent with existing theme.
- Ensure new endpoints are registered in index.ts under /admin.
- Maintain Socket.IO event consistency (io.emit() only from server routes).