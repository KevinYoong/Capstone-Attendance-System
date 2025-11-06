# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Capstone Attendance System** - a full-stack geolocation-based attendance tracking application with separate frontend and backend.

**Tech Stack:**
- **Frontend**: React 19 + Vite, TailwindCSS
- **Backend**: Express.js (Node.js), MySQL with mysql2
- **Authentication**: bcrypt for password hashing, JWT tokens (jsonwebtoken)

## Architecture

### Frontend (`/frontend`)
- **Build Tool**: Vite with React plugin and HMR
- **Styling**: TailwindCSS with PostCSS
- **Structure**:
  - `src/pages/` - Page-level components (LoginPage)
  - `src/components/` - Reusable components (LoginForm)
  - `src/App.jsx` - Root application component (currently renders LoginPage)
  - `src/main.jsx` - Application entry point with StrictMode

### Backend (`/backend`)
- **Single-file API** (`index.js`) using Express with CORS middleware
- **Database**: MySQL connection pool with promise-based queries (mysql2/promise)
- **Authentication Flow**:
  - `/login` POST endpoint accepts `identifier` (student ID or email) and `password`
  - Students can login with student_id OR email
  - Lecturers can ONLY login with email (not numeric ID)
  - Passwords are bcrypt-hashed and verified via `bcrypt.compare()`
  - Returns user object with role (`student` or `lecturer`)

### Database Schema
The backend expects MySQL tables:
- `Student` table with columns: `student_id`, `email`, `password`, `name`
- `Lecturer` table with columns: `lecturer_id`, `email`, `password`, `name`

### Environment Configuration
Backend requires `.env` file with:
- `PORT` - Server port (defaults to 3001)
- `DB_HOST` - MySQL host
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name

## Development Commands

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (Vite HMR)
npm run build        # Production build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend
```bash
cd backend
npm install          # Install dependencies
node index.js        # Start server (default port 3001)
```

**Note**: Backend currently has no start script in package.json - run directly with `node index.js`

### Testing Database Connection
The backend includes a test endpoint:
```bash
curl http://localhost:3001/test_db
```

## Important Implementation Notes

1. **Authentication Logic** (`backend/index.js:26-93`):
   - Identifier with '@' → checks Student table first, then Lecturer table by email
   - Identifier without '@' → checks ONLY Student table by student_id
   - This prevents lecturers from using numeric IDs to login

2. **MySQL Pool**: Backend uses `mysql.createPool().promise()` for async/await support - all queries should use await with destructured array results

3. **CORS**: Currently configured with `cors()` middleware with no restrictions - tighten for production

4. **Password Security**: All passwords must be bcrypt-hashed before storing in database

5. **Frontend API Integration**: LoginForm component (frontend/src/components/LoginForm.jsx:7-11) has a placeholder for backend integration - needs axios call to POST `/login`

## Current State

- Login UI is complete with TailwindCSS styling
- Backend login endpoint is fully functional with role-based authentication
- Frontend-backend integration is NOT YET CONNECTED (LoginForm just logs to console)
- No routing implemented yet (App.jsx only renders LoginPage)
- JWT token generation code is included in dependencies but not yet implemented in the login endpoint
