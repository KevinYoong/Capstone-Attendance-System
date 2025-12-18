import React, { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
} from "lucide-react";
import adminApi from "../../utils/adminApi";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface Semester {
  semester_id: number;
  name: string;
  start_date: string;
  end_date: string;
  current_week: number;
  is_sem_break: boolean;
  status: "active" | "inactive";
}

interface SemesterFormState {
  name: string;
  start_date: string;
  end_date: string;
}

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

export default function AdminSemesters() {
  // Data State
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Editing State
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [form, setForm] = useState<SemesterFormState>({
    name: "",
    start_date: "",
    end_date: "",
  });

  // --------------------------------------------------------------------------
  //                                DATA LOADING
  // --------------------------------------------------------------------------

  const fetchSemesters = async () => {
    try {
      const res = await adminApi.get("/admin/semesters");
      setSemesters(res.data.data);
    } catch (err) {
      console.error("Error loading semesters:", err);
      // alert("Failed to load semesters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  // --------------------------------------------------------------------------
  //                                EVENT HANDLERS
  // --------------------------------------------------------------------------

  // ---- Create ----
  const handleCreateSemester = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      alert("Please fill in all fields.");
      return;
    }
    try {
      await adminApi.post("/admin/semesters", form);
      setShowCreateModal(false);
      await fetchSemesters();
    } catch (err) {
      console.error("Create semester error:", err);
      alert("Failed to create semester");
    }
  };

  // ---- Edit ----
  const openEditModal = (sem: Semester) => {
    setEditingSemester(sem);
    setForm({
      name: sem.name,
      // Added '|| ""' to satisfy TypeScript strict null checks
      start_date: sem.start_date.split("T")[0] || "",
      end_date: sem.end_date.split("T")[0] || "",
    });
    setShowEditModal(true);
  };

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

  // ---- Delete ----
  const handleDeleteSemester = async (id: number) => {
    if (!confirm("Are you sure you want to delete this semester? This action cannot be undone.")) return;

    try {
      await adminApi.delete(`/admin/semesters/${id}`);
      await fetchSemesters();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete semester. It may have active classes linked to it.");
    }
  };

  // ---- Activate ----
  const handleActivateSemester = async (id: number) => {
    try {
      await adminApi.patch(`/admin/semesters/${id}/activate`);
      await fetchSemesters();
    } catch (err) {
      console.error("Activation error:", err);
      alert("Failed to activate semester");
    }
  };

  // --------------------------------------------------------------------------
  //                                RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="p-8 text-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Admin — Semesters
        </h1>

        <button
          onClick={() => {
            setForm({ name: "", start_date: "", end_date: "" });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> 
          <span className="font-medium">New Semester</span>
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-[#181818]/70 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto"> 
          {loading ? (
            <p className="text-gray-400 p-8 text-center">Loading data...</p>
          ) : semesters.length === 0 ? (
            <p className="text-gray-400 p-8 text-center">No semesters found. Create one to get started.</p>
          ) : (
            <table className="w-full text-left text-gray-300">
              <thead className="bg-[#1f1f2f] text-gray-300 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-4 px-6 whitespace-nowrap">Name</th>
                  <th className="py-4 px-6 whitespace-nowrap">Start Date</th>
                  <th className="py-4 px-6 whitespace-nowrap">End Date</th>
                  <th className="py-4 px-6 whitespace-nowrap text-center">Current Week</th>
                  <th className="py-4 px-6 whitespace-nowrap text-center">Break Status</th>
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
                    <td className="py-4 px-6 whitespace-nowrap text-sm font-mono text-gray-400">
                      {new Date(sem.start_date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap text-sm font-mono text-gray-400">
                      {new Date(sem.end_date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap text-center font-bold text-white">
                      {sem.current_week}
                    </td>
                    
                    {/* Break Status */}
                    <td className="py-4 px-6 whitespace-nowrap text-center">
                      {sem.is_sem_break ? (
                        <span className="text-yellow-400 font-medium text-xs bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">
                          On Break
                        </span>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-4 px-6 whitespace-nowrap text-center">
                      {sem.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20 uppercase tracking-wide">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs uppercase tracking-wide">Inactive</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 flex justify-center items-center gap-3 whitespace-nowrap">
                      <ActionButton 
                        onClick={() => openEditModal(sem)} 
                        icon={<Pencil size={18} />} 
                        color="text-blue-400" 
                        tooltip="Edit Details" 
                      />
                      
                      <ActionButton 
                        onClick={() => handleDeleteSemester(sem.semester_id)} 
                        icon={<Trash2 size={18} />} 
                        color="text-red-400" 
                        tooltip="Delete" 
                      />

                      {sem.status !== "active" && (
                        <button
                          onClick={() => handleActivateSemester(sem.semester_id)}
                          className="ml-2 px-3 py-1 bg-green-600/20 hover:bg-green-600 hover:text-white text-green-400 border border-green-600/50 rounded text-xs font-medium transition"
                        >
                          Set Active
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

      {/* ---------------- MODALS ---------------- */}

      {showCreateModal && (
        <SemesterModal
          title="Create New Semester"
          form={form}
          setForm={setForm}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSemester}
          submitText="Create Semester"
        />
      )}

      {showEditModal && editingSemester && (
        <SemesterModal
          title="Edit Semester Details"
          form={form}
          setForm={setForm}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSemester}
          submitText="Save Changes"
        />
      )}
    </div>
  );
}

// ============================================================================
//                                SUB-COMPONENTS
// ============================================================================

/** Helper: Action Button with Tooltip */
function ActionButton({ onClick, icon, color, tooltip }: { onClick: () => void, icon: React.ReactNode, color: string, tooltip: string }) {
  return (
    <div className="relative group">
      <button onClick={onClick} className={`p-2 rounded-lg hover:bg-white/10 transition ${color}`}>
        {icon}
      </button>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {tooltip}
      </div>
    </div>
  );
}

/** Reusable Modal Component for Semesters */
interface SemesterModalProps {
  title: string;
  form: SemesterFormState;
  setForm: React.Dispatch<React.SetStateAction<SemesterFormState>>;
  onClose: () => void;
  onSubmit: () => void;
  submitText: string;
}

function SemesterModal({ title, form, setForm, onClose, onSubmit, submitText }: SemesterModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition text-xl">
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Semester Name</label>
            <input
              className="w-full bg-[#101010] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="e.g. September 2025"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full bg-[#101010] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                className="w-full bg-[#101010] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition"
          >
            Cancel
          </button>

          <button
            onClick={onSubmit}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20 transition"
          >
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}