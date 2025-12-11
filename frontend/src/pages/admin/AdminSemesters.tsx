import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
} from "lucide-react";
import adminApi from "../../utils/adminApi";

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

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);

  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
  });

  // --------------------------
  // Fetch Semesters
  // --------------------------
  const fetchSemesters = async () => {
    try {
      const res = await adminApi.get("/admin/semesters");
      setSemesters(res.data.data);
    } catch (err) {
      console.error("Error loading semesters:", err);
      alert("Failed to load semesters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  // --------------------------
  // Create Semester
  // --------------------------
  const handleCreateSemester = async () => {
    try {
      await adminApi.post("/admin/semesters", form);
      setShowCreateModal(false);
      await fetchSemesters();
    } catch (err) {
      console.error("Create semester error:", err);
      alert("Failed to create semester");
    }
  };

  // --------------------------
  // Edit Semester
  // --------------------------
  const handleEditSemester = async () => {
    if (!editingSemester) return;

    try {
      await adminApi.put(`/admin/semesters/${editingSemester.semester_id}`, form);

      setShowEditModal(false);
      setEditingSemester(null);
      await fetchSemesters();
    } catch (err) {
      console.error("Update semester error:", err);
      alert("Failed to update semester");
    }
  };

  // --------------------------
  // Delete Semester
  // --------------------------
  const handleDeleteSemester = async (id: number) => {
    if (!confirm("Are you sure you want to delete this semester?")) return;

    try {
      await adminApi.delete(`/admin/semesters/${id}`);
      await fetchSemesters();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete semester");
    }
  };

  // --------------------------
  // Activate Semester
  // --------------------------
  const handleActivateSemester = async (id: number) => {
    try {
      await adminApi.patch(`/admin/semesters/${id}/activate`);
      await fetchSemesters();
    } catch (err) {
      console.error("Activation error:", err);
      alert("Failed to activate semester");
    }
  };

  // --------------------------
  // UI
  // --------------------------
  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Semesters</h1>

        <button
          onClick={() => {
            setForm({ name: "", start_date: "", end_date: "" });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
        >
          <Plus size={18} /> New Semester
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-[#181818]/80 border border-white/10 rounded-xl overflow-hidden">
        
        <div className="overflow-x-auto"> 
          {loading ? (
            <p className="text-gray-400 p-6">Loading...</p>
          ) : (
            <table className="w-full text-left text-gray-300">
              <thead className="bg-[#1f1f2f] text-gray-300">
                <tr>
                  <th className="py-4 px-6 whitespace-nowrap">Name</th>
                  <th className="py-4 px-6 whitespace-nowrap">Start Date</th>
                  <th className="py-4 px-6 whitespace-nowrap">End Date</th>
                  <th className="py-4 px-6 whitespace-nowrap">Week</th>
                  {/* Centered Headers */}
                  <th className="py-4 px-6 whitespace-nowrap text-center">Semester Break</th>
                  <th className="py-4 px-6 whitespace-nowrap text-center">Status</th>
                  <th className="py-4 px-6 whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {semesters.map((sem) => (
                  <tr
                    key={sem.semester_id}
                    className="border-t border-white/5 hover:bg-[#222233] transition-colors"
                  >
                    <td className="py-4 px-6 font-medium text-white whitespace-nowrap">{sem.name}</td>
                    <td className="py-4 px-6 whitespace-nowrap">{sem.start_date.slice(0, 10)}</td>
                    <td className="py-4 px-6 whitespace-nowrap">{sem.end_date.slice(0, 10)}</td>
                    <td className="py-4 px-6 whitespace-nowrap">{sem.current_week}</td>
                    
                    {/* Centered Semester Break */}
                    <td className="py-4 px-6 whitespace-nowrap text-center">
                      {sem.is_sem_break ? (
                        <span className="text-yellow-400 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>

                    {/* Centered Status */}
                    <td className="py-4 px-6 whitespace-nowrap text-center">
                      {sem.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-400 text-sm font-semibold border border-green-500/20">
                          <CheckCircle size={14} /> Active
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">Inactive</span>
                      )}
                    </td>

                    {/* Centered Actions with Custom Tooltips */}
                    <td className="py-4 px-6 flex justify-center gap-3 whitespace-nowrap">
                      
                      {/* EDIT BUTTON with Tooltip */}
                      <div className="relative group">
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
                          className="p-2 hover:bg-white/10 rounded-lg transition text-blue-400 hover:text-blue-300"
                        >
                          <Pencil size={18} />
                        </button>
                        {/* Tooltip Popup */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          Edit
                        </div>
                      </div>

                      {/* DELETE BUTTON with Tooltip */}
                      <div className="relative group">
                        <button
                          onClick={() => handleDeleteSemester(sem.semester_id)}
                          className="p-2 hover:bg-white/10 rounded-lg transition text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={18} />
                        </button>
                        {/* Tooltip Popup */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          Delete
                        </div>
                      </div>

                      {sem.status !== "active" && (
                        <button
                          onClick={() => handleActivateSemester(sem.semester_id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition"
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
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <Modal
          title="Create Semester"
          form={form}
          setForm={setForm}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSemester}
        />
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingSemester && (
        <Modal
          title="Edit Semester"
          form={form}
          setForm={setForm}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSemester}
        />
      )}
    </div>
  );
}

function Modal({ title, form, setForm, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-xl">
        <h2 className="text-xl font-bold mb-4">{title}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Semester Name</label>
            <input
              className="w-full bg-[#101010] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. Sem 1 2025/2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full bg-[#101010] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              className="w-full bg-[#101010] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition"
          >
            Cancel
          </button>

          <button
            onClick={onSubmit}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}