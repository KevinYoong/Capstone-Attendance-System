import React, { useState } from "react";

export default function LoginForm() {
  const [identifier, setIdentifier] = useState<string>(""); // can be student ID or email
  const [password, setPassword] = useState<string>("");

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Logging in with:", identifier, password);
    // Later → call backend: /login?identifier=...
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
