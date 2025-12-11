import React, { useEffect, useState } from "react";
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
  ArrowUpDown, // Import for sorting
  Search,      // Import for search bar
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
  classes_assigned?: ClassItem[];
  classes_count?: number; // Backend might send this
}

// 6. Reduced rows per page
const ROWS_PER_PAGE = 10;

export default function AdminLecturers() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [query, setQuery] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<string>("lecturer_id"); // Default sort
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Expand rows (show classes)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Modals & selected lecturer
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<Lecturer | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    async function fetchLecturers() {
        setLoading(true);
        try {
          // Backend needs to support these query params (update adminRoutes.ts if needed)
          // Assuming /admin/lecturers supports q, page, limit, sortBy, order similar to students
          const res = await adminApi.get("/admin/lecturers", {
            params: {
              q: query,
              page: currentPage,
              limit: ROWS_PER_PAGE,
              sortBy: sortField,
              order: sortOrder
            }
          });
          
          setLecturers(res.data.data.lecturers || []);
          setTotalItems(res.data.data.total || 0);
        } catch (err) {
          console.error("Error loading lecturers", err);
          setLecturers([]);
        } finally {
          setLoading(false);
        }
    }
    const timeoutId = setTimeout(() => fetchLecturers(), 300);
    return () => clearTimeout(timeoutId);
  }, [currentPage, query, sortField, sortOrder]); 

  // Sort Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-500 group-hover:text-blue-400" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUp size={14} className="text-blue-400" />
    ) : (
      <ChevronDown size={14} className="text-blue-400" />
    );
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));

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
        const payload = { name: form.name, email: form.email, password: form.password };
        const res = await adminApi.post("/admin/lecturers", payload);
        // Re-fetch to respect sort order, or optimistically append
        setLecturers((prev) => [res.data.data, ...prev]); 
        setShowCreateModal(false);
    } catch (err) { console.error(err); alert("Failed to create lecturer"); }
  };

  const handleEdit = async () => {
    if (!selectedLecturer) return;
    try {
        const payload = { name: form.name };
        const res = await adminApi.put(`/admin/lecturers/${selectedLecturer.lecturer_id}`, payload);
        setLecturers((prev) => prev.map((l) => l.lecturer_id === selectedLecturer.lecturer_id ? res.data.data : l));
        setShowEditModal(false); setSelectedLecturer(null);
    } catch (err) { console.error(err); alert("Failed to update lecturer"); }
  };

  const handleResetPassword = async () => {
    if (!selectedLecturer) return;
    try {
        await adminApi.post(`/admin/lecturers/${selectedLecturer.lecturer_id}/reset-password`, { password: form.password });
        setShowResetModal(false); setSelectedLecturer(null);
    } catch (err) { console.error(err); alert("Failed to reset password"); }
  };

  const handleDelete = async () => {
    if (!selectedLecturer) return;
    try {
        await adminApi.delete(`/admin/lecturers/${selectedLecturer.lecturer_id}`);
        setLecturers((prev) => prev.filter((l) => l.lecturer_id !== selectedLecturer.lecturer_id));
        setShowDeleteModal(false); setSelectedLecturer(null);
    } catch (err) { console.error(err); alert("Failed to delete lecturer"); }
  };

  return (
    <div className="p-8 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Manage Lecturers</h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* 3. Updated Search Bar Placeholder (No ID) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by name or email..." 
              className="pl-10 pr-4 py-2 bg-[#101010] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 w-full sm:w-64 transition"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <UserPlus size={16} /> Add Lecturer
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#181818]/80 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-[#1f1f2f] text-gray-300">
              <tr>
                {/* 3. Removed Lecturer ID Column */}
                
                {/* 4. Sortable Name Header */}
                <th 
                  className="py-4 px-6 text-center whitespace-nowrap cursor-pointer hover:bg-white/5 transition group"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Name
                    {renderSortIcon("name")}
                  </div>
                </th>

                <th className="py-4 px-6 text-center whitespace-nowrap">Email</th>
                <th className="py-4 px-6 text-center whitespace-nowrap">Classes</th>
                <th className="py-4 px-6 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">Loading...</td></tr>
              ) : lecturers.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No lecturers found.</td></tr>
              ) : (
                lecturers.map((lec) => {
                  const isExpanded = expandedRows.has(lec.lecturer_id);
                  // 2. Determine class count from actual array or fallback count
                  const classesCount = lec.classes_assigned?.length ?? lec.classes_count ?? 0;

                  return (
                    // 1. React.Fragment fixes the table nesting bug
                    <React.Fragment key={lec.lecturer_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        
                        <td className="py-4 px-6 text-center whitespace-nowrap font-medium text-white">
                          {lec.name}
                        </td>

                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          {lec.email}
                        </td>

                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleRow(lec.lecturer_id)}
                            className="inline-flex items-center justify-center gap-2 text-gray-300 hover:text-white transition"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {classesCount} classes
                          </button>
                        </td>

                        <td className="py-4 px-6 flex justify-center gap-3 whitespace-nowrap">
                          
                          {/* 5. Tooltips on Action Buttons */}
                          <div className="relative group">
                            <button
                              onClick={() => openEdit(lec)}
                              className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-white/10 rounded-lg transition"
                            >
                              <Edit size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Edit Name</div>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => openReset(lec)}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-white/10 rounded-lg transition"
                            >
                              <KeyRound size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Reset Password</div>
                          </div>

                          <div className="relative group">
                            <button
                              onClick={() => openDelete(lec)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition"
                            >
                              <Trash2 size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Delete</div>
                          </div>

                        </td>
                      </tr>

                      {/* 2. Expanded Class List */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={4} className="p-4">
                            <div className="pl-10 text-left">
                              <h4 className="text-sm uppercase text-gray-500 font-bold mb-2">Assigned Classes</h4>
                              {lec.classes_assigned && lec.classes_assigned.length > 0 ? (
                                <ul className="space-y-1 text-gray-300">
                                  {lec.classes_assigned.map((c) => (
                                    <li key={c.class_id} className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                      <span className="font-medium text-white">{c.class_name}</span>
                                      {c.course_code && <span className="text-gray-500">({c.course_code})</span>}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-gray-500 italic">No classes assigned.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition">
          <ChevronLeft />
        </button>
        <p className="text-gray-300">Page <span className="font-bold text-white">{currentPage}</span> of {totalPages}</p>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition">
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