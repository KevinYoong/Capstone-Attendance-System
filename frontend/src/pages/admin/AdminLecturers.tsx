import { useEffect, useMemo, useState } from "react";
import adminApi from "../../utils/adminApi";
import {
  UserPlus,
  Edit,
  Trash2,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ClassItem {
  class_id: number;
  class_name: string;
  course_code?: string;
}

interface Lecturer {
  lecturer_id: number;
  name: string;
  email: string;
  // optional: classes assigned; frontend will display them
  classes_assigned?: ClassItem[];
}

const ROWS_PER_PAGE = 25;

export default function AdminLecturers() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Search
  const [query, setQuery] = useState<string>("");

  // Expand rows (show classes)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Modals & selected lecturer
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<Lecturer | null>(null);

  // Form state for create / edit / reset
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    async function fetchLecturers() {
        setLoading(true);
        try {
        const res = await adminApi.get("/admin/lecturers");
        setLecturers(res.data.data.lecturers || []);
        } catch (err) {
        console.error("Error loading lecturers", err);
        alert("Failed to load lecturers");
        } finally {
        setLoading(false);
        }
    }
    fetchLecturers();
  }, []); 

  // Filtered + searched list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lecturers;
    return lecturers.filter((l) =>
      String(l.lecturer_id).includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q)
    );
  }, [lecturers, query]);

  // Pagination math
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, startIndex + ROWS_PER_PAGE);

  // Expand / collapse a row
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  // ---------- Handlers for Modals ----------
  const openCreate = () => {
    setForm({ name: "", email: "", password: "" });
    setShowCreateModal(true);
  };

  const openEdit = (lec: Lecturer) => {
    setSelectedLecturer(lec);
    setForm({ name: lec.name, email: lec.email, password: "" });
    setShowEditModal(true);
  };

  const openReset = (lec: Lecturer) => {
    setSelectedLecturer(lec);
    setForm({ name: lec.name, email: lec.email, password: "" });
    setShowResetModal(true);
  };

  const openDelete = (lec: Lecturer) => {
    setSelectedLecturer(lec);
    setShowDeleteModal(true);
  };

  const handleCreate = async () => {
    try {
        const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        };

        const res = await adminApi.post("/admin/lecturers", payload);

        // Append new lecturer to the list
        setLecturers((prev) => [res.data.data, ...prev]);

        setShowCreateModal(false);
    } catch (err) {
        console.error("Create error", err);
        alert("Failed to create lecturer");
    }
  };

  const handleEdit = async () => {
    try {
        if (!selectedLecturer) return;

        const payload = { name: form.name };

        const res = await adminApi.put(`/admin/lecturers/${selectedLecturer.lecturer_id}`, payload);

        // update frontend state
        setLecturers((prev) =>
        prev.map((l) =>
            l.lecturer_id === selectedLecturer.lecturer_id ? res.data.data : l
        )
        );

        setShowEditModal(false);
        setSelectedLecturer(null);
    } catch (err) {
        console.error("Edit error", err);
        alert("Failed to update lecturer");
    }
  };

  const handleResetPassword = async () => {
    try {
        if (!selectedLecturer) return;

        const payload = { password: form.password };

        await adminApi.post(`/admin/lecturers/${selectedLecturer.lecturer_id}/reset-password`, payload);

        setShowResetModal(false);
        setSelectedLecturer(null);
        setForm({ name: "", email: "", password: "" });
    } catch (err) {
        console.error("Reset password error", err);
        alert("Failed to reset password");
    }
  };

  const handleDelete = async () => {
    try {
        if (!selectedLecturer) return;

        await adminApi.delete(`/admin/lecturers/${selectedLecturer.lecturer_id}`);

        setLecturers((prev) =>
        prev.filter((l) => l.lecturer_id !== selectedLecturer.lecturer_id)
        );

        setShowDeleteModal(false);
        setSelectedLecturer(null);
    } catch (err) {
        console.error("Delete error", err);
        alert("Failed to delete lecturer");
    }
  };

  // Keep current page valid when filtered size changes
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manage Lecturers</h1>

        <div className="flex items-center gap-3">
          <input
            placeholder="Search by id, name or email..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-[#101010] border border-white/10 text-gray-200 w-[320px]"
          />

          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2"
          >
            <UserPlus size={16} /> Add Lecturer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#1f1f2f] text-gray-300">
            <tr>
              <th className="p-4">Lecturer ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Classes</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  No lecturers found.
                </td>
              </tr>
            ) : (
              pageItems.map((lec) => {
                const isExpanded = expandedRows.has(lec.lecturer_id);
                const classesCount = lec.classes_assigned?.length ?? 0;
                return (
                  <tbody key={lec.lecturer_id}>
                    <tr className="border-t border-white/5 hover:bg-[#222233]">
                      <td className="p-4 align-top">{lec.lecturer_id}</td>

                      <td className="p-4 align-top">{lec.name}</td>

                      <td className="p-4 align-top">
                        <div className="max-w-[280px] truncate">{lec.email}</div>
                      </td>

                      <td className="p-4 align-top">
                        <button
                          onClick={() => toggleRow(lec.lecturer_id)}
                          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span>
                            {isExpanded ? "Hide classes" : `▼ ${classesCount} classes`}
                          </span>
                        </button>
                      </td>

                      <td className="p-4 text-right align-top flex justify-end gap-3">
                        <button
                          title="Edit name"
                          onClick={() => openEdit(lec)}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          title="Reset password"
                          onClick={() => openReset(lec)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <KeyRound size={16} />
                        </button>

                        <button
                          title="Delete lecturer"
                          onClick={() => openDelete(lec)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded row showing class list */}
                    {isExpanded && (
                      <tr className="bg-[#15151b]">
                        <td colSpan={5} className="p-4 border-t border-white/5">
                          {classesCount === 0 ? (
                            <div className="text-gray-400 italic">No classes assigned.</div>
                          ) : (
                            <ul className="space-y-1">
                              {lec.classes_assigned!.map((c) => (
                                <li key={c.class_id} className="text-gray-200">
                                  • {c.class_name} {c.course_code ? `(${c.course_code})` : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-2 disabled:opacity-30"
        >
          <ChevronLeft />
        </button>

        <p>
          Page <span className="font-semibold">{currentPage}</span> of{" "}
          {totalPages}
        </p>

        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="p-2 disabled:opacity-30"
        >
          <ChevronRight />
        </button>
      </div>

      {/* ---------------- CREATE MODAL ---------------- */}
      {showCreateModal && (
        <ModalShell title="Create Lecturer" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button className="px-4 py-2 bg-gray-600 rounded-lg" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 rounded-lg" onClick={handleCreate}>
                Create
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ---------------- EDIT MODAL ---------------- */}
      {showEditModal && selectedLecturer && (
        <ModalShell title="Edit Lecturer" onClose={() => setShowEditModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            {/* Email is read-only per requirement */}
            <input
              className="w-full p-3 bg-[#0b0b0b] border border-white/10 rounded-lg text-gray-400"
              placeholder="Email (read-only)"
              value={form.email}
              disabled
            />

            <div className="flex justify-end gap-3 mt-4">
              <button className="px-4 py-2 bg-gray-600 rounded-lg" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 rounded-lg" onClick={handleEdit}>
                Save
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ---------------- RESET PASSWORD MODAL ---------------- */}
      {showResetModal && selectedLecturer && (
        <ModalShell title={`Reset password — ${selectedLecturer.name}`} onClose={() => setShowResetModal(false)}>
          <div className="space-y-3">
            <input
              type="password"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="New password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button className="px-4 py-2 bg-gray-600 rounded-lg" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-green-600 rounded-lg" onClick={handleResetPassword}>
                Reset Password
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ---------------- DELETE MODAL ---------------- */}
      {showDeleteModal && selectedLecturer && (
        <ModalShell title={`Delete lecturer — ${selectedLecturer.name}`} onClose={() => setShowDeleteModal(false)}>
          <div className="space-y-3">
            <p className="text-gray-300">
              Deleting this lecturer will unassign them from any classes. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 mt-4">
              <button className="px-4 py-2 bg-gray-600 rounded-lg" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-red-600 rounded-lg" onClick={handleDelete}>
                Delete Lecturer
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ---------- Generic Modal Shell ---------- */
function ModalShell({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}