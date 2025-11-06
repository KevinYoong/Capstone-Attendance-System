// src/pages/LoginPage.jsx
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923]">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#181818]/80 backdrop-blur-xl shadow-xl border border-white/10">
        <h1 className="text-3xl font-semibold text-center text-white mb-6">
          Attendance System
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}