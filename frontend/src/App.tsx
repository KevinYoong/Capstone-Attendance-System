import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import LecturerDashboard from "./pages/LecturerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLayout from "./layouts/AdminLayout";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminLecturers from "./pages/admin/AdminLecturers";
import AdminClasses from "./pages/admin/AdminClasses";
import AdminSemesters from "./pages/admin/AdminSemesters";
import LecturerClassDetail from "./pages/LecturerClassDetail";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

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

          {/* Lecturer Only */}
          <Route
            path="/lecturer"
            element={
              <ProtectedRoute allowedRoles={["lecturer"]}>
                <LecturerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Only */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout>
                  <Routes>
                    <Route path="" element={<AdminDashboard />} />
                    <Route path="semesters" element={<AdminSemesters />} />
                    <Route path="students" element={<AdminStudents />} />
                    <Route path="lecturers" element={<AdminLecturers />} />
                    <Route path="classes" element={<AdminClasses />} />
                  </Routes>
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Lecturer Class Detail */}
          <Route
            path="/lecturer/class/:class_id"
            element={
              <ProtectedRoute allowedRoles={["lecturer"]}>
                <LecturerClassDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
