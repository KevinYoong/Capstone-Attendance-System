# CLAUDE.md (Updated)
Guidance file for AI coding assistants working on this repository.

**Last Updated:** December 2025
**Based on Commit:** `5df57dd - Implement Socket.IO server & integrate real-time infrastructure groundwork`

---

## Project Overview

This is a **Capstone Attendance System**: a full-stack geolocation-based attendance tracking app with separate interfaces for students and lecturers. The system enables real-time check-in activation and verification based on **location**, with plans for **QR scan auto-check-in**, class session management, and attendance analytics.

### Current Status (✅ = Implemented, ⏳ = Pending, 🚧 = Partially Implemented)

**Core Infrastructure:**
- ✅ Database schema created (MySQL)
- ✅ Backend Express server with TypeScript
- ✅ Frontend React app with TypeScript
- ✅ Socket.IO real-time infrastructure
- ✅ Frontend and backend fully connected
- ✅ Authentication system with bcrypt
- ✅ Role-based routing and protected routes

**Features Implemented:**
- ✅ User login (students via email OR student_id, lecturers via email only)
- ✅ Student dashboard with weekly class schedule
- ✅ Lecturer dashboard with weekly class schedule
- ✅ Lecturer class detail view with student list
- ✅ Check-in session activation (30-minute expiry)
- ✅ Real-time check-in notifications via Socket.IO
- ✅ Persistent user sessions (localStorage)

**Features Pending:**
- ⏳ Student check-in submission endpoint
- ⏳ Geolocation verification (distance calculation)
- ⏳ QR code scanner for quick check-in
- ⏳ Check-in expiry enforcement
- ⏳ JWT token-based authentication
- ⏳ Online mode toggle (bypass geolocation)
- ⏳ Attendance history view for lecturers
- ⏳ Attendance analytics dashboard for students

---

## Tech Stack

| Layer | Technology | Version |
|------|------------|---------|
| **Frontend** | React + Vite | 19.1.1 |
| **Frontend Language** | TypeScript | Latest |
| **Styling** | TailwindCSS | Latest |
| **Routing** | React Router | 7.9.5 |
| **Backend** | Node.js (Express) | 5.1.0 |
| **Backend Language** | TypeScript | Latest |
| **Database** | MySQL | Latest (`mysql2/promise` 3.15.3) |
| **Auth** | bcrypt | 6.0.0 |
| **Real-time** | Socket.IO | 4.8.1 (server & client) |
| **HTTP Client** | Axios | Latest |
| **Build & Dev** | Vite HMR, tsx (TypeScript runner) | Latest |

**Future Additions:**
- JWT (jsonwebtoken 9.0.2 installed but not yet implemented)

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
│   │   ├── components/
│   │   │   ├── LoginForm.tsx         # Login form with validation
│   │   │   └── ProtectedRoute.tsx    # Role-based route protection
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # Global auth state (Context API)
│   │   ├── services/
│   │   │   └── api.ts                # Axios API client
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
- `phone_number` (VARCHAR)
- `created_at` (TIMESTAMP)

**Lecturer Table:**
- `lecturer_id` (PK, AUTO_INCREMENT)
- `name` (VARCHAR)
- `email` (VARCHAR, UNIQUE)
- `password` (VARCHAR, bcrypt hashed)
- `phone_number` (VARCHAR)
- `created_at` (TIMESTAMP)

**Class Table:**
- `class_id` (PK, AUTO_INCREMENT)
- `class_name` (VARCHAR)
- `course_code` (VARCHAR)
- `day_of_week` (VARCHAR) - e.g., "Monday"
- `start_time` (TIME) - e.g., "09:00:00"
- `end_time` (TIME) - e.g., "11:00:00"
- `class_type` (VARCHAR) - e.g., "Lecture", "Tutorial"
- `lecturer_id` (FK → Lecturer)

**StudentClass Table:**
- `student_id` (FK → Student)
- `class_id` (FK → Class)

**Session Table:**
- `session_id` (PK, AUTO_INCREMENT)
- `class_id` (FK → Class)
- `started_at` (DATETIME)
- `expires_at` (DATETIME) - 30 minutes after start
- `online_mode` (BOOLEAN) - Bypasses geolocation if TRUE

**Checkin Table:**
- `checkin_id` (PK, AUTO_INCREMENT)
- `session_id` (FK → Session)
- `student_id` (FK → Student)
- `checkin_time` (DATETIME)
- `status` (VARCHAR) - e.g., "present", "late", "absent"

---

## Authentication Rules

| User Type | Login Identifier | Allowed? | Notes |
|----------|----------------|---------|------|
| Student | **Email** | ✅ | Standard email login |
| Student | **Student ID (numeric)** | ✅ | Unique to students |
| Lecturer | **Email** | ✅ | Standard email login |
| Lecturer | Numeric ID login | ❌ | Intentionally prevented |

**Password Security:**
- All passwords are **bcrypt-hashed** before storage
- Never stored in plain text
- Compared using `bcrypt.compare()` during login

**Session Management:**
- User data stored in AuthContext (React Context API)
- Persisted to `localStorage` for session continuity
- No JWT tokens yet (planned for future)

---

## Backend Implementation

### Base URL
```
http://localhost:3001
```

### Core Files

| File | Purpose | Location |
|------|---------|----------|
| `index.ts` | Main server, Socket.IO setup, login endpoint | `/backend/index.ts` (127 lines) |
| `db.ts` | MySQL connection pool | `/backend/db.ts` (14 lines) |
| `studentRoutes.ts` | Student-specific endpoints | `/backend/src/routes/studentRoutes.ts` (85 lines) |
| `lecturerRoutes.ts` | Lecturer-specific endpoints | `/backend/src/routes/lecturerRoutes.ts` (159 lines) |

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

**Logic:**
1. Check if identifier is numeric → Query Student table by `student_id`
2. Check if identifier contains `@` → Try Student table by email, then Lecturer by email
3. Compare password with `bcrypt.compare()`
4. Return user object with role

**Location:** `/backend/index.ts:59-127`

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
- ✅ Fetches schedule from `/student/{id}/classes/week`
- ✅ Displays classes grouped by weekday (collapsible sections)
- ✅ Shows active check-in status via Socket.IO listener
- ✅ Check-in button enabled only when session is active
- ✅ Real-time updates: listens for `checkinActivated` events
- ✅ Auto-expands current day on load
- ✅ Logout button
- ⏳ Check-in submission (button exists but no endpoint yet)

**Key State:**
```typescript
const [weekSchedule, setWeekSchedule] = useState<WeekSchedule>({});
const [openDays, setOpenDays] = useState<string[]>([]);
const [activeSessions, setActiveSessions] = useState<Record<number, any>>({});
```

**Socket.IO Listener:**
```typescript
socket.on("checkinActivated", (data) => {
  setActiveSessions((prev) => ({
    ...prev,
    [data.class_id]: data,
  }));
});
```

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

### Styling

**Framework:** TailwindCSS
**Theme:** Dark mode with gradients
**Color Palette:**
- Background: Dark blues/blacks (`bg-gray-900`, `bg-gray-800`)
- Text: White (`text-white`)
- Accents: Blue (`bg-blue-600`), Yellow (`bg-yellow-500`), Green (`bg-green-500`), Red (`bg-red-500`)

**No CSS-in-JS libraries used.**

---

## Development Workflow

### Running the Application

**Backend:**
```bash
cd backend
npm install
npm run dev  # Runs tsx watch index.ts
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Runs Vite dev server
```

**Database:**
- Ensure MySQL server is running
- Create `.env` file in `/backend` with DB credentials
- Import schema (if schema file exists) or create tables manually

---

### Build & Deployment

**Backend:**
```bash
npm run build   # Compiles TypeScript to JavaScript
npm start       # Runs compiled code
```

**Frontend:**
```bash
npm run build   # Vite production build → /dist
npm run preview # Preview production build
```

---

## Current Implementation Status

### ✅ Completed Features

| Feature | Description | Files Involved |
|---------|-------------|----------------|
| User Authentication | bcrypt password hashing, login endpoint | `backend/index.ts`, `LoginForm.tsx` |
| Role-based Routing | Separate student/lecturer dashboards | `App.tsx`, `ProtectedRoute.tsx` |
| Weekly Schedule Display | Classes grouped by weekday | `StudentDashboard.tsx`, `LecturerDashboard.tsx` |
| Check-in Activation | 30-minute session creation | `lecturerRoutes.ts`, `LecturerClassDetail.tsx` |
| Real-time Notifications | Socket.IO infrastructure | `backend/index.ts`, `StudentDashboard.tsx` |
| Persistent Sessions | localStorage user state | `AuthContext.tsx` |
| TypeScript Migration | Full type safety | All `.ts` and `.tsx` files |
| Responsive UI | TailwindCSS dark theme | All frontend components |

---

### ⏳ Pending Features

| Feature | Description | Priority | Estimated Effort |
|---------|-------------|----------|------------------|
| Student Check-in Submission | POST endpoint to record check-in | 🔴 High | 2-4 hours |
| Geolocation Verification | Distance calculation (lat/lng) | 🔴 High | 4-6 hours |
| Check-in Expiry Enforcement | Prevent check-in after 30 min | 🟡 Medium | 2-3 hours |
| QR Code Scanner | Mobile-optimized QR scan UI | 🟡 Medium | 4-6 hours |
| JWT Authentication | Token-based auth instead of localStorage | 🟡 Medium | 3-5 hours |
| Online Mode Toggle | Bypass geolocation for online classes | 🟢 Low | 2-3 hours |
| Attendance History View | Lecturer view of past sessions | 🟢 Low | 4-6 hours |
| Student Analytics Dashboard | Charts for attendance % | 🟢 Low | 6-8 hours |
| Database Migrations | Version-controlled schema changes | 🟢 Low | 2-4 hours |

---

### 🚧 Known Issues

1. **studentRoutes.ts Socket.IO Integration Issue**
   - File: `/backend/src/routes/studentRoutes.ts`
   - Issue: Route handler exports function that takes `io` parameter but not called with it in `index.ts`
   - Impact: Socket.IO events in student routes won't work
   - Fix: Update `index.ts` to pass `io` instance to student routes

2. **Hardcoded Student Statuses**
   - File: `/frontend/src/pages/LecturerClassDetail.tsx`
   - Issue: Student statuses hardcoded as "pending" instead of fetching from database
   - Impact: Check-in status not accurately reflected
   - Fix: Update `/lecturer/class/:id/details` endpoint to join with Checkin table

3. **Missing Check-in Submission Endpoint**
   - File: `/backend/src/routes/studentRoutes.ts` (needs to be added)
   - Issue: Students can see "Check In" button but clicking only shows alert
   - Impact: Check-in flow incomplete
   - Fix: Implement `POST /student/checkin` endpoint

4. **No Check-in Expiry Validation**
   - Files: Backend routes
   - Issue: System doesn't prevent check-in after 30-minute expiry
   - Impact: Students can check in at any time
   - Fix: Add expiry check in check-in submission endpoint

---

## Development Roadmap

### Phase 1: Complete Core Check-in Flow (Priority 🔴)
**Goal:** Enable students to actually check in

| Task | Endpoint/File | Description |
|------|---------------|-------------|
| 1.1 | `POST /student/checkin` | Implement check-in submission endpoint |
| 1.2 | `studentRoutes.ts` | Validate session expiry before accepting check-in |
| 1.3 | `StudentDashboard.tsx` | Connect "Check In" button to API endpoint |
| 1.4 | `lecturerRoutes.ts` | Fix student status query to show actual check-in status |

**Expected Outcome:** Students can click "Check In" button and see confirmation, lecturers see real-time attendance updates

---

### Phase 2: Geolocation Verification (Priority 🔴)
**Goal:** Ensure students are physically present

| Task | Description |
|------|-------------|
| 2.1 | Add `latitude`, `longitude` columns to Class table |
| 2.2 | Add geolocation fields to Checkin table |
| 2.3 | Implement Haversine formula for distance calculation |
| 2.4 | Frontend: Request location permission on check-in |
| 2.5 | Backend: Validate student is within X meters of class location |
| 2.6 | Frontend: Show error if student too far away |

**Expected Outcome:** Students must be within 50m (configurable) of class location to check in

---

### Phase 3: QR Code Quick Check-in (Priority 🟡)
**Goal:** Enable fast check-in via QR scan

| Task | Description |
|------|-------------|
| 3.1 | Generate unique QR code for each session |
| 3.2 | QR code encodes: `session_id` + validation token |
| 3.3 | Frontend: QR scanner page (mobile-optimized) |
| 3.4 | Backend: `POST /student/checkin/qr` endpoint |
| 3.5 | Auto-check-in after successful QR scan |

**Expected Outcome:** Students can scan QR code displayed by lecturer to check in instantly

---

### Phase 4: Online Mode & Enhancements (Priority 🟡)
**Goal:** Support hybrid learning

| Task | Description |
|------|-------------|
| 4.1 | Add online mode toggle UI in LecturerClassDetail |
| 4.2 | `PATCH /lecturer/session/:id/toggle-online` endpoint |
| 4.3 | Frontend: Hide geolocation requirement if online_mode = TRUE |
| 4.4 | Implement check-in expiry warning notifications |
| 4.5 | Add manual session end button for lecturers |

**Expected Outcome:** Lecturers can enable online mode to allow remote check-ins

---

### Phase 5: History & Analytics (Priority 🟢)
**Goal:** Provide attendance insights

| Task | Description |
|------|-------------|
| 5.1 | Lecturer: Attendance history page (past sessions) |
| 5.2 | Student: Personal attendance analytics dashboard |
| 5.3 | Charts: Attendance % per class, attendance trends |
| 5.4 | Export attendance data as CSV |

**Expected Outcome:** Users can view historical attendance data and trends

---

### Phase 6: Security & Production Readiness (Priority 🟢)
**Goal:** Make app production-ready

| Task | Description |
|------|-------------|
| 6.1 | Implement JWT token-based authentication |
| 6.2 | Add request validation middleware |
| 6.3 | Implement rate limiting |
| 6.4 | Add API error logging |
| 6.5 | Environment-specific configs (dev/prod) |
| 6.6 | Database migrations system |

**Expected Outcome:** Secure, scalable, production-ready application

---

## Key Rules for AI Assistants

1. **Do not rewrite working code unless necessary.**
2. **Frontend must use functional components + hooks (TypeScript).**
3. **Backend must use async/await with `db.query()` (TypeScript).**
4. **NEVER store raw passwords. Always hash using bcrypt.**
5. **Follow existing response format for all endpoints:**
   ```typescript
   return res.status(200).json({ success: true, data: ... });
   ```
6. **Socket.IO events must be broadcast via `io.emit()` from backend routes.**
7. **All protected routes must verify user authentication (future: JWT validation).**
8. **Use TypeScript types/interfaces for all data structures.**
9. **Follow TailwindCSS for styling (no inline CSS or CSS-in-JS).**
10. **Database queries must use parameterized statements to prevent SQL injection.**

---

## Common Development Tasks

### Adding a New Backend Endpoint

1. Choose appropriate route file: `studentRoutes.ts` or `lecturerRoutes.ts`
2. Define TypeScript interface for request/response
3. Add route handler:
   ```typescript
   router.post('/new-endpoint', async (req, res) => {
     try {
       const [results] = await db.query('SELECT ...');
       return res.status(200).json({ success: true, data: results });
     } catch (error) {
       return res.status(500).json({ error: 'Error message' });
     }
   });
   ```
4. Test with Postman/curl
5. Update this documentation

---

### Adding a New Frontend Page

1. Create component in `/frontend/src/pages/`
2. Use TypeScript + functional component
3. Add route in `App.tsx`:
   ```tsx
   <Route
     path="/new-page"
     element={
       <ProtectedRoute allowedRoles={["student"]}>
         <NewPage />
       </ProtectedRoute>
     }
   />
   ```
4. Style with TailwindCSS
5. Update this documentation

---

### Adding a Socket.IO Event

1. Backend: Emit event in route handler:
   ```typescript
   io.emit("newEvent", { data: ... });
   ```
2. Frontend: Listen in component:
   ```typescript
   useEffect(() => {
     socket.on("newEvent", (data) => {
       console.log(data);
     });
     return () => socket.off("newEvent");
   }, []);
   ```
3. Document event in this file

---

## Testing Credentials (Example)

**Student Login:**
- Identifier: `student@example.com` or `12345678`
- Password: (As set in database)

**Lecturer Login:**
- Identifier: `lecturer@example.com`
- Password: (As set in database)

**Note:** Create test users in database with bcrypt-hashed passwords.

---

## Useful Commands

**Backend Development:**
```bash
npm run dev      # Start server with watch mode
npm run build    # Compile TypeScript
npm start        # Run compiled code
```

**Frontend Development:**
```bash
npm run dev      # Vite dev server (HMR)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

**Database:**
```bash
mysql -u root -p attendance_system  # Connect to database
```

---

## Environment Variables

**Backend (`.env`):**
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=attendance_system
PORT=3001
```

**Note:** Never commit `.env` file to git.

---

## Important File Paths

| Component | Path |
|-----------|------|
| Main Server | `/backend/index.ts` |
| Database Connection | `/backend/db.ts` |
| Student Routes | `/backend/src/routes/studentRoutes.ts` |
| Lecturer Routes | `/backend/src/routes/lecturerRoutes.ts` |
| Main App | `/frontend/src/App.tsx` |
| Login Form | `/frontend/src/components/LoginForm.tsx` |
| Student Dashboard | `/frontend/src/pages/StudentDashboard.tsx` |
| Lecturer Dashboard | `/frontend/src/pages/LecturerDashboard.tsx` |
| Class Detail | `/frontend/src/pages/LecturerClassDetail.tsx` |
| Auth Context | `/frontend/src/context/AuthContext.tsx` |
| API Service | `/frontend/src/services/api.ts` |

---

## Troubleshooting

**Frontend won't start:**
- Check Node version (should be 18+)
- Run `npm install` in `/frontend`
- Check for port conflicts (default: 5173)

**Backend won't start:**
- Check `.env` file exists with correct credentials
- Verify MySQL server is running
- Run `npm install` in `/backend`
- Check for port conflicts (default: 3001)

**Database connection errors:**
- Verify MySQL credentials in `.env`
- Check database exists: `CREATE DATABASE attendance_system;`
- Verify user has permissions

**Socket.IO not working:**
- Check CORS settings in `backend/index.ts`
- Verify frontend connects to correct URL (`http://localhost:3001`)
- Check browser console for WebSocket errors

---

## Additional Resources

- **React Router Docs:** https://reactrouter.com/
- **Socket.IO Docs:** https://socket.io/docs/
- **TailwindCSS Docs:** https://tailwindcss.com/docs
- **MySQL2 Docs:** https://github.com/sidorares/node-mysql2
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/

---

**Last Updated:** December 2, 2025
**Maintained By:** Development Team
**Version:** 2.0 (Socket.IO Implementation Complete)
