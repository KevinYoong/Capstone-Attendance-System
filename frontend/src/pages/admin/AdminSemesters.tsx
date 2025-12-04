import { useEffect, useState } from "react";
import axios from "axios";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
} from "lucide-react";

interface Semester {
  semester_id: number;
  name: string;
  start_date: string;
  end_date: string;
  current_week: number;
  is_sem_break: boolean;
  status: string;
}

export default function AdminSemesters() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);

  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
  });

  // Fetch all semesters
  const fetchSemesters = async () => {
    try {
      const res = await axios.get("http://localhost:3001/admin/semesters");
      setSemesters(res.data.data);
    } catch (err) {
      console.error("Error loading semesters:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  // -------------------------
  // Create new semester
  // -------------------------
  const handleCreateSemester = async () => {
    try {
      await axios.post("http://localhost:3001/admin/semesters", form);
      setShowCreateModal(false);
      fetchSemesters();
    } catch (err) {
      console.error("Create semester error:", err);
    }
  };

  // -------------------------
  // Update existing semester
  // -------------------------
  const handleEditSemester = async () => {
    if (!editingSemester) return;

    try {
      await axios.put(
        `http://localhost:3001/admin/semesters/${editingSemester.semester_id}`,
        form
      );

      setShowEditModal(false);
      setEditingSemester(null);
      fetchSemesters();

    } catch (err) {
      console.error("Update semester error:", err);
    }
  };

  // -------------------------
  // Delete semester
  // -------------------------
  const handleDeleteSemester = async (id: number) => {
    if (!confirm("Are you sure you want to delete this semester?")) return;

    try {
      await axios.delete(`http://localhost:3001/admin/semesters/${id}`);
      fetchSemesters();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // -------------------------
  // Set Active Semester
  // -------------------------
  const handleActivateSemester = async (id: number) => {
    try {
      await axios.patch(`http://localhost:3001/admin/semesters/${id}/activate`);
      fetchSemesters();
    } catch (err) {
      console.error("Activation error:", err);
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Semesters</h1>

        <button
          onClick={() => {
            setForm({ name: "", start_date: "", end_date: "" });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
        >
          <Plus size={18} /> New Semester
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#181818]/80 border border-white/10 rounded-xl p-6">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <table className="w-full text-left text-gray-300">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3">Name</th>
                <th className="py-3">Start</th>
                <th className="py-3">End</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {semesters.map((sem) => (
                <tr
                  key={sem.semester_id}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="py-3">{sem.name}</td>
                  <td className="py-3">{sem.start_date}</td>
                  <td className="py-3">{sem.end_date}</td>
                  <td className="py-3">
                    {sem.status === "active" ? (
                      <span className="text-green-400 font-semibold flex items-center gap-1">
                        <CheckCircle size={16} /> Active
                      </span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>

                  <td className="py-3 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setEditingSemester(sem);
                        setForm({
                          name: sem.name,
                          start_date: sem.start_date,
                          end_date: sem.end_date,
                        });
                        setShowEditModal(true);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg"
                    >
                      <Pencil size={18} className="text-blue-400" />
                    </button>

                    <button
                      onClick={() => handleDeleteSemester(sem.semester_id)}
                      className="p-2 hover:bg-white/10 rounded-lg"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>

                    {sem.status !== "active" && (
                      <button
                        onClick={() => handleActivateSemester(sem.semester_id)}
                        className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------------- CREATE MODAL ---------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-[#181818] p-6 rounded-xl w-[400px] border border-white/10">
            <h2 className="text-xl font-bold mb-4">Create Semester</h2>

            <div className="space-y-4">
              <input
                className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                placeholder="Semester Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="date"
                className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
              <input
                type="date"
                className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                value={form.end_date}
                onChange={(e) =>
                  setForm({ ...form, end_date: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSemester}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- EDIT MODAL ---------------- */}
      {showEditModal && editingSemester && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-[#181818] p-6 rounded-xl w-[400px] border border-white/10">
            <h2 className="text-xl font-bold mb-4">Edit Semester</h2>

            <div className="space-y-4">
              <input
                className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                placeholder="Semester Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="date"
                className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
              <input
                type="date"
                className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                value={form.end_date}
                onChange={(e) =>
                  setForm({ ...form, end_date: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSemester}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}