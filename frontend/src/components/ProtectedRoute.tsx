import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useAuth();

  // If not logged in → go to login
  if (!user) return <Navigate to="/" replace />;

  // If role restricted → verify role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // If admin role required, ensure token exists as a first-line check
  if (allowedRoles && allowedRoles.includes("admin")) {
    if (!user.token) {
      // no token in context/localStorage — force login
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}