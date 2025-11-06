# CLAUDE.md  
Guidance file for AI coding assistants working on this repository.

---

## Project Overview

This is a **Capstone Attendance System**: a full-stack geolocation-based attendance tracking app with separate interfaces for students and lecturers.

The system verifies attendance based on **location**, optionally via **QR scan → auto-check-in**, and tracks class history and attendance analytics.

### Current Status (as of now)
- ✅ Database schema created (MySQL)
- ✅ Backend Express server running with `/login` endpoint
- ✅ Login UI implemented in React + Tailwind
- ✅ Students can log in via student_id **or** email
- ✅ Lecturers log in via email only
- ⏳ Frontend and backend are **not yet connected**
- ⏳ No dashboard or routing yet

---

## Tech Stack

| Layer | Technology |
|------|------------|
| **Frontend** | React 19 + Vite, TailwindCSS |
| **Backend** | Node.js (Express) |
| **Database** | MySQL (`mysql2/promise`) |
| **Auth** | bcrypt (password hashing), JWT planned |
| **Build & Dev** | Vite HMR, npm scripts |

---

## Folder Structure

attendance_system/
│
├── backend/
│ ├── index.js # Express server
│ ├── .env # DB credentials (not committed)
│ └── package.json
│
├── frontend/
│ ├── src/
│ │ ├── pages/ # Page components (LoginPage, Dashboard, etc.)
│ │ ├── components/ # Reusable components (LoginForm)
│ │ ├── App.jsx
│ │ └── main.jsx
│ ├── index.html
│ └── package.json
│
└── CLAUDE.md # THIS FILE


---

## Authentication Rules

| User Type | Login Identifier | Allowed? | Notes |
|----------|----------------|---------|------|
| Student | **Email** | ✅ |
| Student | **Student ID (numeric)** | ✅ |
| Lecturer | **Email** | ✅ |
| Lecturer | Numeric ID login | ❌ Prevented intentionally |

Passwords are **bcrypt-hashed**, never stored in plain text.

---

## Backend Notes (Express API)

### Base URL

http://localhost:3001

### Existing Endpoints
| Method | Route | Purpose |
|--------|--------|---------|
| GET | `/test_db` | Verify DB connection |
| POST | `/login` | Authenticate student/lecturer |

### Planned Backend Endpoints
| Increment | Feature | Routes To Implement |
|----------|---------|--------------------|
| Increment 1 | Student check-in + session handling | `POST /sessions/start`, `POST /checkin` |
| Increment 2 | Geolocation enforcement | Validate coordinates in `POST /checkin` |
| Increment 3 | Online mode toggle | `PATCH /sessions/:id/toggle-online` |
| Increment 4 | Lecturer attendance history | `GET /sessions/:id/attendance`, `GET /lecturer/:id/sessions` |
| Increment 5 | Student dashboard & analytics | `GET /student/:id/stats` |

We will later introduce:
- JWT token issuance at `/login`
- `Authorization: Bearer <token>` middleware

---

## Frontend Notes (React + Tailwind)

### Current Pages
| Page | File | State |
|------|------|-------|
| Login Page | `src/pages/LoginPage.jsx` | ✅ Done |

### Planned Pages (Upcoming)
| Page | Purpose |
|------|---------|
| Student Dashboard | Show joined classes & check-in button |
| Lecturer Dashboard | Start/end class sessions, view attendees |
| Class Attendance View | View attendance logs |
| Setup Page (optional) | Lecturer creates classes, add students |

### Planned UI Enhancements
- QR Code scanner page (mobile optimized)
- Geolocation permission request UI
- Toast / Snackbar notifications for feedback

---

## Development Roadmap (Increments)

| Increment | Feature | Status | Expected Output |
|----------|---------|--------|----------------|
| 1 | Replace Code-Based Check-In with **One-Click Check-In + QR Shortcut** | ⏳ Pending | `checkin` route, start session UI |
| 2 | **Geolocation Verification** | ⏳ Pending | GPS accuracy & distance threshold logic |
| 3 | **Online Mode Switch** (no geolocation required) | ⏳ Pending | Toggle UI + backend route |
| 4 | **Lecturer Attendance History View** | ⏳ Pending | Dashboard page + API routes |
| 5 | **Student Attendance Analytics Dashboard** | ⏳ Pending | Charts (attendance % per class) |

---

## Key Rules AI Assistants Should Follow

1. **Do not rewrite working code unless necessary.**
2. **Frontend must use functional components + hooks.**
3. **Backend must use async/await with `db.query()`.**
4. **NEVER store raw passwords. Always hash using bcrypt.**
5. If creating a new backend route → follow existing file structure and response format:
   ```js
   return res.status(200).json({ success: true, data: ... });