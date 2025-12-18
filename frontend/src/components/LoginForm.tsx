import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AlertCircle } from "lucide-react"; // Optional icon for better UX

export default function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await loginUser({ identifier, password });

      if (response.token && response.user.role === "admin") {
        login(response.user as any, response.token);
      } else {
        login(response.user as any);
      }

      if (response.user.role === "student") navigate("/student");
      else if (response.user.role === "lecturer") navigate("/lecturer");
      else if (response.user.role === "admin") navigate("/admin/semesters");
    } catch (err: any) {
      // This sets the error message state
      setError(err.response?.data?.message || "Invalid login credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5 text-white">
      
      {/* 🔴 NEW: Error Message Popup */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

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
        />
      </div>

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

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed transition text-white font-medium flex justify-center items-center"
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
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