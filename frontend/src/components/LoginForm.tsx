import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AlertCircle } from "lucide-react"; 

/**
 * LoginForm Component
 * * Handles user authentication for Students, Lecturers, and Admins.
 * * Features:
 * - Accepts Email (Admins/Lecturers) or Student ID (Students).
 * - Manages loading state and error feedback.
 * - Redirects users to their specific dashboard based on role.
 */
export default function LoginForm() {
  // Form State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  
  // UI State
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  /**
   * Submits the login request to the backend.
   * On success: Updates global AuthContext and redirects user.
   * On failure: Displays an error alert.
   */
  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await loginUser({ identifier, password });

      // 1. Update Global Auth State
      // Note: Admins receive a JWT token which is stored for protected API calls.
      if (response.token && response.user.role === "admin") {
        login(response.user as any, response.token);
      } else {
        login(response.user as any);
      }

      // 2. Redirect based on Role
      switch (response.user.role) {
        case "student":
          navigate("/student");
          break;
        case "lecturer":
          navigate("/lecturer");
          break;
        case "admin":
          navigate("/admin/semesters");
          break;
        default:
          setError("Unknown user role detected.");
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      // Extract error message from backend response or fallback to default
      setError(err.response?.data?.message || "Invalid login credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5 text-white">
      
      {/* Error Message Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Identifier Input (Email or ID) */}
      <div>
        <label className="block text-sm mb-1 text-gray-300">
          Student ID / Email
        </label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg bg-[#101010] border border-white/10 focus:border-blue-500 focus:outline-none transition"
          placeholder="e.g. 11223344  or  student@example.edu"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
        />
      </div>

      {/* Password Input */}
      <div>
        <label className="block text-sm mb-1 text-gray-300">Password</label>
        <input
          type="password"
          className="w-full px-4 py-3 rounded-lg bg-[#101010] border border-white/10 focus:border-blue-500 focus:outline-none transition"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {/* Submit Button with Loading Spinner */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed transition text-white font-medium flex justify-center items-center"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Signing In...</span>
          </div>
        ) : (
          "Sign In"
        )}
      </button>

      <p className="text-center text-sm text-gray-400">
        Powered by Geolocation Attendance
      </p>
    </form>
  );
}