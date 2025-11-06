import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

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

      // Save user in AuthContext
      login(response.user);

      // Navigate based on role
      navigate(
        response.user.role === "student"
          ? "/student"
          : "/lecturer"
      );

    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid login credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5 text-white">
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
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition text-white font-medium"
      >
        Sign In
      </button>

      <p className="text-center text-sm text-gray-400">
        Powered by Geolocation Attendance
      </p>
    </form>
  );
}
