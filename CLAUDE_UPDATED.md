**CLAUDE.md (Updated December 2025)**
Guidance file for AI coding assistants working on this repository.
**Last Updated**: December 2025
**Based on Commit**: Latest — Auto Session Expiry + Missed Attendance Integration

**Project Overview**
This repository contains the **Capstone Attendance System**, a full-stack, real-time geolocation-based attendance tracking platform with three user roles:
- Students — view classes, check in (GPS or online mode), view status
- Lecturers — activate sessions, monitor real-time attendance, review check-ins
- Admins — manage semesters, users, classes, and assignments
The system supports **automatic session expiry, geolocation distance validation, online-mode check-ins, a complete semester/week navigation system**, and upcoming Phase 7 **attendance analytics**.

### Current Status (✅ = Implemented, ⏳ = Pending, 🚧 = Partially Implemented)

**Core Infrastructure:**
- ✅ Database schema created (MySQL)
- ✅ Backend Express server with TypeScript
- ✅ Frontend React app with TypeScript
- ✅ Socket.IO real-time infrastructure
- ✅ Frontend and backend fully connected
- ✅ Authentication system with bcrypt
- ✅ Role-based routing and protected routes

**Curent Status**
| Component                               |         Status               |
| Socket.IO real-time system              |         | ✅ Complete                                  |
| Check-in session activation                       | ✅ Complete                                  |
| Student one-click check-in                        | ✅ Complete                                  |
| Automatic session expiry handler                  | ✅ Complete                                  |
| Missed attendance auto-insertion                  | ✅ Complete                                  |
| GPS geolocation verification                      | ✅ Complete                                  |
| Online mode (no GPS)                              | ✅ Complete                                  |
| Week navigation + semester system                 | ✅ Complete                                  |
| Admin portal (CRUD for users, classes, semesters) | ✅ Complete                                  |
| Student dashboard                                 | ✅ Complete                                  |
| Lecturer dashboard + class detail view            | ✅ Complete                                  |
| Attendance history API                            | 🚧 In Progress (Phase 7)                    |
| Lecturer analytics                                | 🚧 Phase 7 (current)                        |
| Student analytics                                 | 🚧 Phase 7 (current)                        |
| QR code check-in                                  | ❌ Removed (no longer part of project scope) |

---

## Tech Stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Frontend       | React (TypeScript), Vite         |
| Styling        | TailwindCSS                      |
| Realtime       | Socket.IO (client + server)      |
| Backend        | Node.js (Express + TypeScript)   |
| Database       | MySQL (`mysql2/promise`)         |
| Authentication | bcrypt                           |
| API Client     | Axios                            |
| Build Tools    | tsx, Vite                        |
| Storage        | localStorage session persistence |

---

## Folder Structure

```
Capstone-Attendance-System/
│
├── backend/                          # Express + TypeScript server
│   ├── index.ts                      # Main server, Socket.IO setup, login endpoint
│   ├── db.ts                         # MySQL connection pool
│   ├── src/
│   │   └── routes/
│   │       ├── studentRoutes.ts      # Student-specific endpoints
│   │       └── lecturerRoutes.ts     # Lecturer-specific endpoints
│   │       └── adminRoutes.ts        # Admin-specific endpoints
│   │   ├── utils/
│   │   │   └── semesterUtils.ts     # Week numbering system
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                          # DB credentials (not committed)
│   └── .gitignore
│
├── frontend/                         # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx         # Login UI wrapper
│   │   │   ├── StudentDashboard.tsx  # Student weekly schedule & check-in
│   │   │   ├── LecturerDashboard.tsx # Lecturer weekly schedule
│   │   │   └── LecturerClassDetail.tsx # Class details, students, check-in activation
│   │   │   ├── admin/
│   │   │   │   └── AdminClasses.tsx  # Show the classes in the admin page 
│   │   │   │   └── AdminDashboard.tsx # Show the admin dashboard 
│   │   │   │   └── AdminLecturers.tsx # Show the lecturers in the admin page 
│   │   │   │   └── AdminSemester.tsx  # Show the semesters in the admin page
│   │   │   │   └── AdminStudents.tsx  # Show the students in the admin page 
│   │   ├── components/
│   │   │   ├── LoginForm.tsx         # Login form with validation
│   │   │   └── ProtectedRoute.tsx    # Role-based route protection
│   │   │   └── AdminSidebar.tsx      # Sidebar used throughout all admin pages
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # Global auth state (Context API)
│   │   ├── services/
│   │   │   └── api.ts                # Axios API client
│   │   ├── utils/
│   │   │   └── adminAPI.ts           # Centralised Axios API client
│   │   │   └── socket.ts             # Centralised socket used for frontend
│   │   ├── App.tsx                   # Main app component with routing
│   │   ├── main.tsx                  # Entry point
│   │   ├── index.css                 # TailwindCSS imports
│   │   └── App.css                   # Legacy styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── .gitignore
│
├── CLAUDE.md                         # Original project guidelines
├── CLAUDE_UPDATED.md                 # THIS FILE (updated documentation)
└── .gitignore
```

---

## Database Schema

Based on SQL queries used throughout the application:

### Tables

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| **Student** | `student_id` | Student user accounts |
| **Lecturer** | `lecturer_id` | Lecturer user accounts |
| **Class** | `class_id` | Class definitions with schedule |
| **StudentClass** | `(student_id, class_id)` | Student enrollment (junction table) |
| **Session** | `session_id` | Check-in sessions with expiry |
| **Checkin** | `checkin_id` | Student check-in records |

### Column Details

**Student Table:**
- `student_id` (PK, AUTO_INCREMENT)
- `name` (VARCHAR)
- `email` (VARCHAR, UNIQUE)
- `password` (VARCHAR, bcrypt hashed)

**Lecturer Table:**
- `lecturer_id` (PK, AUTO_INCREMENT)
- `name` (VARCHAR)
- `email` (VARCHAR, UNIQUE)
- `password` (VARCHAR, bcrypt hashed)

**Class Table:**
- class_id (int)
- lecturer_id (int)
- class_name (varchar(255))
- course_code (varchar(45))
- time (varchar(255))
- location_lat (decimal(10,8))
- location_lng (decimal(11,8))
- day_of_week (enum('Monday','Tuesday','Wednesday','Thursday','Friday'))
- start_time (time)
- end_time (time)
- class_type (enum('Lecture','Tutorial'))

**StudentClass Table:**
- `student_id` (FK → Student)
- `class_id` (FK → Class)
- `joined_at` (TIMESTAMP)

**Session Table:**
- `session_id` (PK, AUTO_INCREMENT)
- `class_id` (FK → Class)
- `started_at` (DATETIME)
- `expires_at` (DATETIME) - 30 minutes after start
- `online_mode` (BOOLEAN) - Bypasses geolocation if TRUE
- `is_expires` (BOOLEAN)

**Checkin Table:**
- `checkin_id` (PK, AUTO_INCREMENT)
- `session_id` (FK → Session)
- `student_id` (FK → Student)
- `checkin_time` (DATETIME)
- `status` (VARCHAR) - e.g., "present", "late", "absent"
- `student_lat` (decimal(10,8))
- `student_lng` (decimal(11,8))
- `accuracy` (decimal(7,2))

---

## Authentication Rules
| Identifier         | Students | Lecturers | Admin |
| ------------------ | -------- | --------- | ----- |
| Email              | ✅       | ✅       | ✅   |
| Student ID numeric | ✅       | ❌       | ❌   |

**Password Security:**
- All passwords are **bcrypt-hashed** before storage
- Never stored in plain text
- Compared using `bcrypt.compare()` during login

**Session Management:**
- User data stored in AuthContext (React Context API)
- Persisted to `localStorage` for session continuity
- No JWT tokens yet (planned for future)

---

## Backend Implementation Overview 

### Base URL
```
http://localhost:3001
```

### Core Files

| File                | Purpose                                   |
| `index.ts`          | Express server, Socket.IO, login, background job init|
| `studentRoutes.ts`  | Student endpoints                         |
| `lecturerRoutes.ts` | Lecturer endpoints                        |
| `adminRoutes.ts`    | Admin CRUD endpoints                      |
| `semesterRoutes.ts` | Semester system                           |
| `geolocation.ts`    | Distance calculation                      |
| `sessionExpiryJob.ts`| Auto-expiry + missed check-ins           |

### API Endpoints

#### Authentication

| Method | Route | Auth Required | Purpose | Status |
|--------|-------|---------------|---------|--------|
| POST | `/login` | ❌ | Authenticate user | ✅ Implemented |

**Request Body:**
```json
{
  "identifier": "student@example.com" OR "12345678",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "student@example.com",
    "role": "student" OR "lecturer"
  }
}
```

**Core Feature Logic:**
Core Feature Logic
1. Session Activation
Lecturer triggers activation → backend:
- creates a Session row
- sets expires_at
- emits Socket.IO event
- class turns yellow (check-in open)
Frontend responds immediately.

2. Student Check-in
Students perform check-in via:POST /student/checkin
Backend logic:
- Validate session exists & not expired
- Validate student is enrolled
- If online_mode = false → validate GPS using Haversine
- Insert a Checkin record
- Emit studentCheckedIn
UI turns green (checked in).

3. Auto Session Expiry (Phase 6 — COMPLETE)
A background job runs every 10 seconds:
- Finds sessions where expires_at < NOW()
- Marks session as expired (is_expired = 1)
- Inserts "missed" check-ins for students who:
  - joined BEFORE session started
  - did NOT check in
Frontend receives: sessionExpired
Student dashboards show red (missed). 
Lecturer dashboards update pending → missed.

---

#### Student Endpoints

| Method | Route | Auth Required | Purpose | Status |
|--------|-------|---------------|---------|--------|
| GET | `/student/:student_id/classes/week` | ✅ | Fetch weekly class schedule | ✅ Implemented |
| POST | `/student/session-started` | ✅ | Emit session start event | ⚠️ Legacy/Unused |

**GET /student/:student_id/classes/week**

**Response:**
```json
{
  "Monday": [
    {
      "class_id": 1,
      "class_name": "Software Engineering",
      "course_code": "CS301",
      "day_of_week": "Monday",
      "start_time": "09:00:00",
      "end_time": "11:00:00",
      "class_type": "Lecture",
      "lecturer_name": "Dr. Smith"
    }
  ],
  "Tuesday": [...],
  ...
}
```

**Location:** `/backend/src/routes/studentRoutes.ts:10-70`

---

#### Lecturer Endpoints

| Method | Route | Auth Required | Purpose | Status |
|--------|-------|---------------|---------|--------|
| GET | `/lecturer/:lecturer_id/classes/week` | ✅ | Fetch weekly class schedule | ✅ Implemented |
| GET | `/lecturer/class/:class_id/details` | ✅ | Get class info + students + session | ✅ Implemented |
| POST | `/lecturer/class/:class_id/activate-checkin` | ✅ | Create session & broadcast event | ✅ Implemented |

**GET /lecturer/:lecturer_id/classes/week**

Same format as student schedule endpoint.

**Location:** `/backend/src/routes/lecturerRoutes.ts:11-75`

---

**GET /lecturer/class/:class_id/details**

**Response:**
```json
{
  "classInfo": {
    "class_id": 1,
    "class_name": "Software Engineering",
    "course_code": "CS301",
    "day_of_week": "Monday",
    "start_time": "09:00:00",
    "end_time": "11:00:00",
    "class_type": "Lecture",
    "lecturer_name": "Dr. Smith"
  },
  "students": [
    {
      "student_id": 1,
      "name": "John Doe",
      "email": "student@example.com"
    }
  ],
  "session": {
    "session_id": 1,
    "started_at": "2025-12-02T09:00:00.000Z",
    "expires_at": "2025-12-02T09:30:00.000Z",
    "online_mode": 0
  } OR null,
  "checkins": [
    {
      "student_id": 1,
      "checkin_time": "2025-12-02T09:05:00.000Z",
      "status": "present"
    }
  ] OR []
}
```

**Location:** `/backend/src/routes/lecturerRoutes.ts:77-123`

---

**POST /lecturer/class/:class_id/activate-checkin**

**Request Body:**
```json
{
  "lecturer_id": 1
}
```

**Logic:**
1. Creates new Session with 30-minute expiry
2. Emits `checkinActivated` event via Socket.IO
3. Returns session data

**Response:**
```json
{
  "success": true,
  "session": {
    "session_id": 1,
    "class_id": 1,
    "started_at": "2025-12-02T09:00:00.000Z",
    "expires_at": "2025-12-02T09:30:00.000Z"
  }
}
```

**Socket.IO Event Emitted:**
```javascript
io.emit("checkinActivated", {
  class_id: 1,
  session_id: 1,
  startedAt: "2025-12-02T09:00:00.000Z",
  expiresAt: "2025-12-02T09:30:00.000Z"
});
```

**Location:** `/backend/src/routes/lecturerRoutes.ts:125-159`

---

### Socket.IO Real-time Infrastructure

**Server Setup:**
```typescript
const io: Server = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});
```

**Events Implemented:**

| Event Name | Direction | Payload | Purpose | Status |
|------------|-----------|---------|---------|--------|
| `checkinActivated` | Server → Client | `{ class_id, session_id, startedAt, expiresAt }` | Notify students check-in is active | ✅ Implemented |
| `session_started` | Client → Server | (Unused) | Legacy event | ⚠️ Exists but unused |

**Location:** `/backend/index.ts:28-57`

**Current Usage:**
- Real-time check-in activation broadcast to all connected clients
- Student dashboards listen and enable check-in buttons

**Future Events (Planned):**
- `checkinExpired` - Notify when session expires
- `studentCheckedIn` - Broadcast when student checks in
- `sessionEnded` - Manual session termination by lecturer

---

### Database Connection

**File:** `db.ts`

**Configuration:**
```typescript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

**Environment Variables Required (`.env`):**
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=attendance_system
PORT=3001
```

**Note:** `.env` file is excluded from git and must be created manually.

---

## Frontend Implementation

### Routes

| Path | Component | Protection | Purpose |
|------|-----------|------------|---------|
| `/` | LoginPage | None | User login |
| `/student` | StudentDashboard | Student role | Student weekly schedule & check-in |
| `/lecturer` | LecturerDashboard | Lecturer role | Lecturer weekly schedule |
| `/lecturer/class/:class_id` | LecturerClassDetail | Lecturer role | Class details & check-in activation |

**Routing Library:** React Router v7.9.5
**Protection:** ProtectedRoute component with role verification

**Location:** `/frontend/src/App.tsx:1-50`

---

### Pages

#### 1. LoginPage
**Purpose:** Login UI wrapper
**Features:**
- Dark gradient background
- Renders LoginForm component
- No business logic

**Location:** `/frontend/src/pages/LoginPage.tsx:1-15`

---

#### 2. StudentDashboard
**Purpose:** Display student's weekly class schedule with check-in functionality

**Features:**
- Weekly schedule
- Auto-expands today
- Real-time updates
- Check-in with GPS or online mode
- Shows:
  - 🟢 Checked in
  - 🔴 Missed
  - 🟡 Check-in open
  - ⚪ Pending

**Location:** `/frontend/src/pages/StudentDashboard.tsx:1-205`

---

#### 3. LecturerDashboard
**Purpose:** Display lecturer's weekly class schedule

**Features:**
- ✅ Fetches schedule from `/lecturer/{id}/classes/week`
- ✅ Displays classes grouped by weekday (collapsible sections)
- ✅ "Activate Check-in" button navigates to class detail page
- ✅ Logout button

**Location:** `/frontend/src/pages/LecturerDashboard.tsx:1-148`

---

#### 4. LecturerClassDetail
**Purpose:** Detailed view for a specific class with check-in activation

**Features:**
- ✅ Fetches class details from `/lecturer/class/{id}/details`
- ✅ Shows class info (name, code, day, time, type, lecturer)
- ✅ Lists enrolled students with their check-in status
- ✅ "Activate Check-in" button: sends POST to activate-checkin endpoint
- ✅ Updates session display when check-in is activated
- ✅ Shows expiry time for active check-ins
- ✅ Back button for navigation
- 🚧 Student statuses currently hardcoded as "pending" (should fetch from DB)

**Key State:**
```typescript
const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
const [session, setSession] = useState<Session | null>(null);
const [students, setStudents] = useState<Student[]>([]);
const [loading, setLoading] = useState<boolean>(true);
```

**Location:** `/frontend/src/pages/LecturerClassDetail.tsx:1-153`

---

### Components

#### LoginForm
**Purpose:** Handles login flow

**Features:**
- ✅ Input fields for identifier (email or student_id) and password
- ✅ Calls `loginUser()` API with credentials
- ✅ Saves user to AuthContext on success
- ✅ Redirects based on role: `/student` or `/lecturer`
- ✅ Error handling with user-friendly messages
- ✅ Loading state during submission

**Location:** `/frontend/src/components/LoginForm.tsx:1-81`

---

#### ProtectedRoute
**Purpose:** Role-based route protection

**Usage:**
```tsx
<Route
  path="/student"
  element={
    <ProtectedRoute allowedRoles={["student"]}>
      <StudentDashboard />
    </ProtectedRoute>
  }
/>
```

**Location:** `/frontend/src/components/ProtectedRoute.tsx:1-23`

---

### Context & Services

#### AuthContext
**Purpose:** Global authentication state management

**Features:**
- ✅ Context API for user state
- ✅ `login(userData)` - Sets user and saves to localStorage
- ✅ `logout()` - Clears user and localStorage
- ✅ `isAuthenticated` - Boolean flag
- ✅ Auto-restore user from localStorage on app load

**Hook Usage:**
```typescript
const { user, login, logout, isAuthenticated } = useAuth();
```

**Location:** `/frontend/src/context/AuthContext.tsx:1-52`

---

#### API Service
**Purpose:** Centralized API client

**Features:**
- ✅ Axios instance with base URL: `http://localhost:3001`
- ✅ `loginUser(credentials)` - POST to `/login`
- ✅ TypeScript interfaces for requests/responses

**Usage:**
```typescript
import { loginUser } from "../services/api";

const response = await loginUser({
  identifier: "student@example.com",
  password: "password123",
});
```

**Location:** `/frontend/src/services/api.ts:1-36`

---

## Development Roadmap
✅ Phase 1: Basic Check-in Flow (COMPLETE)
    ✅ Socket.IO real-time infrastructure
    ✅ Lecturer activates check-in session
    ✅ Student one-click check-in
    ✅ Real-time UI updates (yellow → green)
    ✅ Session expiry (2 minutes for testing)

Key Files:
    backend/index.ts - Socket.IO server setup
    backend/src/routes/lecturerRoutes.ts - POST /lecturer/activate-checkin
    backend/src/routes/studentRoutes.ts - POST /student/checkin
    frontend/src/pages/StudentDashboard.tsx - Socket.IO listeners
    frontend/src/pages/LecturerClassDetail.tsx - Real-time attendance view

✅ Phase 2: Geolocation Verification (COMPLETE)
    ✅ Haversine distance calculation function
    ✅ Browser Geolocation API integration
    ✅ Backend location validation (500m campus radius)
    ✅ GPS data stored in database (student_lat, student_lng, accuracy)
    ✅ Online mode bypass option

Key Files:
    backend/src/routes/studentRoutes.ts - calculateDistance(), geolocation validation
    frontend/src/pages/StudentDashboard.tsx - navigator.geolocation.getCurrentPosition()
    backend/.env - CAMPUS_LATITUDE, CAMPUS_LONGITUDE, CAMPUS_RADIUS

Database:
    Checkin table has columns: student_lat, student_lng, accuracy

🔄 Phase 3: Semester & Week System (COMPLETE)
✅ Completed Tasks:

Task 1: Database Setup
    Created Semester table (semester_id, name, start_date, end_date, current_week, is_sem_break, status)
    Created Admin table (admin_id, name, email, password)
    Modified Class table (added semester_id, start_week, end_week columns)
    Seeded "September 2025" semester (start: 2025-01-06)
    Migration file: backend/migrations/003_add_semester_system.sql

Task 2: Backend Semester Logic
    Created backend/src/routes/semesterRoutes.ts
    Endpoint: GET /semester/current - Returns active semester info
    Endpoint: GET /semester/:id - Get specific semester
    Registered in backend/index.ts

Task 3: Update Class Endpoints to Filter by Week
    Updated GET /student/:id/classes/week?week=X to accept week parameter
    Filters classes by semester and week range (start_week, end_week)
    Returns empty schedule during semester break
    Response includes semester metadata and week_number

Task 3 Enhancement: Automatic Week Calculation
    Created backend/src/utils/semesterUtils.ts
    Function: calculateCurrentWeek(startDate) - Automatically calculates current week from dates
    No manual updates needed - system syncs with real calendar dates
    Logic:
        Week 1-7: Days 0-48 (49 days)
        Sem Break: Days 49-55 (7 days, between weeks 7 and 8)
        Week 8-14: Days 56-104 (49 days)
    Updated semesterRoutes.ts and studentRoutes.ts to use date-based calculation

Task 4: Frontend Week Navigation UI (StudentDashboard) - NEXT
    Add week selector UI: "Week X of 14" display
    Add "Previous Week" / "Next Week" navigation buttons
    Fetch semester data from GET /semester/current
    Update API call to use ?week=X parameter
    Show "🏖️ Semester Break" banner when is_viewing_sem_break = true
    Disable check-in during semester break

Task 5: Frontend Week Navigation UI (LecturerDashboard)
    Same as Task 4 but for lecturer view
    Update lecturer class endpoints to be week-aware
    Show which week classes are being viewed

Task 6: Test Complete Semester System
    Test week navigation (browsing weeks 1-14)
    Test semester break display
    Verify automatic week calculation
    Test that classes only appear in their assigned weeks

Task 6A: Enhancements 
    Updating backend endpoints to accept week parameter
    Update StudentDashboard: allow navigation to weeks 1-14
    Add future week indicator (blue)
    Add dates to day headers in StudentDashboard
    Refetch schedule when selectedWeek changes
    Apply same changes to LecturerDashboard
    Implement semester break display

✅ Phase 4: Admin Portal - Core Functions (COMPLETE)
Estimated Time: 3-4 days
Tasks:
    Update /login endpoint to support admin role
    Create AdminDashboard.tsx (base layout, routing, sidebar)
    Admin: Manage Semesters UI 
        View all semesters (table)
        Create new semester (form with name, start_date, end_date)
        Set active semester (toggle)
        View calculated current week (read-only, auto-calculated from dates)
    Styling to match student/lecturer dashboards

New Routes:
    POST /login (updated to handle admin)
    GET /admin/semesters
    POST /admin/semesters
    PATCH /admin/semesters/:id/activate

✅ Phase 5: Admin Portal - Class Assignment (COMPLETE)
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

✅ Phase 6: Auto Session Expiry (COMPLETE)
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

---

## Key Rules for AI Assistants

1. **Do not refactor working logic unless asked.**
2. **Maintain TypeScript types everywhere.**
3. **Backend must use async/await + parameterized queries.**
4. **Never store plaintext passwords.**
5. **All Socket.IO events must match existing payload structure.**
6. **Maintain consistent response objects ({ success: true, data: ... }).**
7. **React components must use hooks (no classes).**
8. **TailwindCSS for all UI styling.**
9. **Keep semester/week logic consistent with backend utilities.**
10. **Auto-expiry job must never duplicate missed entries (use transaction + row-level lock).**

## Environment Variables

**Backend (`.env`):**
```
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=0127482848
DB_NAME=attendance_system
PORT=3001

# JWT Configuration
JWT_SECRET=supersecretkey123
JWT_EXPIRES_IN=1d

# DEVELOPMENT: Home Location (for testing from home)
CAMPUS_LATITUDE=3.0709795053170406
CAMPUS_LONGITUDE=101.56627247844794
CAMPUS_RADIUS=500

# PRODUCTION: University Campus (uncomment when deploying)
# CAMPUS_LATITUDE=3.0673419209015633
# CAMPUS_LONGITUDE=101.6037889559458
# CAMPUS_RADIUS=500
```

**Last Updated:** December 2, 2025
**Maintained By:** Development Team
**Version:** 3.0 — Auto Expiry + Missed Logic Integrated
