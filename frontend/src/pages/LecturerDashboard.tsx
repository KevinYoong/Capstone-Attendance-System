import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LecturerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1b2a] to-[#051923] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lecturer Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            Logout
          </button>
        </div>
        
        <div className="bg-[#181818]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10">
          <h2 className="text-xl mb-4">Welcome, {user?.name}!</h2>
          <p className="text-gray-400">Email: {user?.email}</p>
          <p className="text-gray-400">Lecturer ID: {user?.id}</p>
          
          <div className="mt-6">
            <p className="text-gray-300">Dashboard features coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}