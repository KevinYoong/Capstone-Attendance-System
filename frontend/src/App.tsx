import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import LecturerDashboard from "./pages/LecturerDashboard";
import AdminLayout from "./layouts/AdminLayout";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminLecturers from "./pages/admin/AdminLecturers";
import AdminClasses from "./pages/admin/AdminClasses";
import AdminSemesters from "./pages/admin/AdminSemesters";
import LecturerClassDetail from "./pages/LecturerClassDetail";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import StudentAnalyticsOverview from "./pages/analytics/StudentAnalyticsOverview";
import StudentClassAnalytics from "./pages/analytics/StudentClassAnalytics";
import LecturerAnalyticsOverview from "./pages/analytics/LecturerAnalyticsOverview";
import LecturerClassAnalytics from "./pages/analytics/LecturerClassAnalytics";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          {/* Student Only */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/analytics"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentAnalyticsOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/analytics/class/:class_id"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentClassAnalytics />
              </ProtectedRoute>
            }
          />

          {/* Lecturer Only */}
          <Route
            path="/lecturer"
            element={
              <ProtectedRoute allowedRoles={["lecturer"]}>
                <LecturerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer/analytics"
            element={
              <ProtectedRoute allowedRoles={["lecturer"]}>
                <LecturerAnalyticsOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer/analytics/class/:class_id"
            element={
              <ProtectedRoute allowedRoles={["lecturer"]}>
                <LecturerClassAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer/class/:class_id"
            element={
              <ProtectedRoute allowedRoles={["lecturer"]}>
                <LecturerClassDetail />
              </ProtectedRoute>
            }
          />

          {/* Admin Only */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="semesters" replace />} />
            <Route path="semesters" element={<AdminSemesters />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="lecturers" element={<AdminLecturers />} />
            <Route path="classes" element={<AdminClasses />} />
          </Route>

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}