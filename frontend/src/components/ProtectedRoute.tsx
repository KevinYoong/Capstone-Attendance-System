import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface ProtectedRouteProps {
  /** The child component to render if access is granted */
  children: ReactNode;
  /** List of roles allowed to access this route (e.g., ['admin', 'lecturer']) */
  allowedRoles?: string[];
}

// ============================================================================
//                                COMPONENT
// ============================================================================

/**
 * ProtectedRoute Wrapper
 * * Guards routes against unauthorized access.
 * * Performs three levels of checks:
 * 1. **Authentication:** Is the user logged in?
 * 2. **Authorization:** Does the user have the required role?
 * 3. **Security:** If the user is an Admin, do they have a valid token?
 */
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useAuth();

  // 1. Check if user is logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 2. Check Role Authorization
  // If allowedRoles is provided, ensure the user's role is in the list.
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />; // Redirect to login (or unauthorized page)
  }

  // 3. Extra Security Check for Admins
  // Admins must have a valid JWT token stored in the context to make API calls.
  if (allowedRoles && allowedRoles.includes("admin")) {
    if (!user.token) {
      console.warn("⚠️ Admin access attempted without token. Redirecting...");
      return <Navigate to="/" replace />;
    }
  }

  // Access Granted
  return <>{children}</>;
}