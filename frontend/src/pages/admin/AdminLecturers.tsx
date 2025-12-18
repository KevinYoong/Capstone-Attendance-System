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
  ArrowUpDown,
  Search,
} from "lucide-react";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

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
  classes_count?: number;
}

const ROWS_PER_PAGE = 10;

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

export default function AdminLecturers() {
  // Data State
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [query, setQuery] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<string>("lecturer_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI State
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Modal Visibility State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedLecturer, setSelectedLecturer] = useState<Lecturer | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");

  // --------------------------------------------------------------------------
  //                                DATA LOADING
  // --------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      try {
        const res = await adminApi.get("/admin/lecturers", {
          params: {
            q: query,
            page: currentPage,
            limit: ROWS_PER_PAGE,
            sortBy: sortField,
            order: sortOrder,
          },
        });
        if (isMounted) {
          setLecturers(res.data.data.lecturers || []);
          setTotalItems(res.data.data.total || 0);
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const timeoutId = setTimeout(() => fetchData(), 300);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [currentPage, query, sortField, sortOrder]);

  // --------------------------------------------------------------------------
  //                                EVENT HANDLERS
  // --------------------------------------------------------------------------

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // ---- CREATE ----
  const openCreate = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    try {
      await adminApi.post("/admin/lecturers", {
        name: formName,
        email: formEmail,
        password: formPassword,
      });
      // Refresh list after creation
      const res = await adminApi.get("/admin/lecturers", {
        params: { q: query, page: currentPage, limit: ROWS_PER_PAGE, sortBy: sortField, order: sortOrder },
      });
      setLecturers(res.data.data.lecturers || []);
      setTotalItems(res.data.data.total || 0);
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create lecturer");
    }
  };

  // ---- EDIT ----
  const openEdit = (l: Lecturer) => {
    setSelectedLecturer(l);
    setFormName(l.name);
    setFormEmail(l.email);
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedLecturer) return;
    try {
      await adminApi.put(`/admin/lecturers/${selectedLecturer.lecturer_id}`, {
        name: formName,
        email: formEmail,
      });
      setLecturers((prev) =>
        prev.map((l) =>
          l.lecturer_id === selectedLecturer.lecturer_id
            ? { ...l, name: formName, email: formEmail }
            : l
        )
      );
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update lecturer");
    }
  };

  // ---- RESET PASSWORD ----
  const openResetPassword = (l: Lecturer) => {
    setSelectedLecturer(l);
    setFormPassword("");
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!selectedLecturer) return;
    try {
      await adminApi.post(`/admin/lecturers/${selectedLecturer.lecturer_id}/reset-password`, {
        password: formPassword,
      });
      alert("Password reset successfully");
      setShowResetPasswordModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to reset password");
    }
  };

  // ---- DELETE ----
  const openDelete = (l: Lecturer) => {
    setSelectedLecturer(l);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedLecturer) return;
    try {
      await adminApi.delete(`/admin/lecturers/${selectedLecturer.lecturer_id}`);
      setLecturers((prev) => prev.filter((l) => l.lecturer_id !== selectedLecturer.lecturer_id));
      setShowDeleteModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete lecturer");
    }
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

  // --------------------------------------------------------------------------
  //                                RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="p-8 text-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Admin — Lecturers
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search Bar */}
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
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add Lecturer</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden mb-6 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-[#1f1f2f] text-gray-300 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th 
                  className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap"
                  onClick={() => handleSort("lecturer_id")}
                >
                  <div className="flex items-center gap-2">ID {renderSortIcon("lecturer_id")}</div>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">Name {renderSortIcon("name")}</div>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center gap-2">Email {renderSortIcon("email")}</div>
                </th>
                <th className="p-4 text-center">Workload</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading data...</td></tr>
              ) : lecturers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No lecturers found.</td></tr>
              ) : (
                lecturers.map((lec) => {
                  const isExpanded = expandedRows.has(lec.lecturer_id);
                  const assigned = lec.classes_assigned || [];

                  return (
                    <React.Fragment key={lec.lecturer_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        <td className="p-4 font-mono text-gray-400 text-sm">#{lec.lecturer_id}</td>
                        <td className="p-4 font-medium text-white">{lec.name}</td>
                        <td className="p-4 text-gray-300">{lec.email}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => toggleRow(lec.lecturer_id)}
                            className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-300 hover:text-white transition group"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span className="group-hover:underline decoration-blue-500/50 underline-offset-4">
                              {lec.classes_count ?? assigned.length} Classes
                            </span>
                          </button>
                        </td>
                        <td className="p-4 text-center flex justify-center gap-2">
                          <ActionButton onClick={() => openEdit(lec)} icon={<Edit size={18} />} color="text-yellow-400" tooltip="Edit Info" />
                          <ActionButton onClick={() => openResetPassword(lec)} icon={<KeyRound size={18} />} color="text-blue-400" tooltip="Reset Password" />
                          <ActionButton onClick={() => openDelete(lec)} icon={<Trash2 size={18} />} color="text-red-400" tooltip="Delete Account" />
                        </td>
                      </tr>
                      
                      {/* Expanded Row Details */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={5} className="p-4">
                             <div className="pl-12 border-l-2 border-blue-500/50 ml-8">
                               <h4 className="text-xs uppercase text-gray-500 font-bold mb-3">Assigned Classes</h4>
                               {assigned.length === 0 ? (
                                 <div className="text-gray-500 italic text-sm">No classes assigned yet.</div>
                               ) : (
                                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {assigned.map(c => (
                                      <div key={c.class_id} className="flex items-center gap-2 text-gray-300 text-sm bg-white/5 p-2 rounded">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="font-bold text-white">{c.course_code}</span>
                                        <span className="text-gray-400 truncate">— {c.class_name}</span>
                                      </div>
                                    ))}
                                 </div>
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

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4 mb-6">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition text-white"
        >
          <ChevronLeft />
        </button>
        <p className="text-gray-300 text-sm">
          Page <span className="font-bold text-white">{currentPage}</span> of {totalPages}
        </p>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition text-white"
        >
          <ChevronRight />
        </button>
      </div>

      {/* ---------------- MODALS ---------------- */}

      {/* Create Modal */}
      {showCreateModal && (
        <ModalShell title="Add New Lecturer" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                placeholder="e.g. Dr. John Doe"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email Address</label>
              <input
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                placeholder="e.g. john.doe@sunway.edu.my"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Initial Password</label>
              <input
                type="password"
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                placeholder="Enter password..."
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
              <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition" onClick={handleCreate}>
                Create Lecturer
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <ModalShell title="Edit Lecturer Details" onClose={() => setShowEditModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email Address</label>
              <input
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
              <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white shadow-lg shadow-green-500/20 transition" onClick={handleEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <ModalShell title={`Reset Password — ${selectedLecturer?.name}`} onClose={() => setShowResetPasswordModal(false)}>
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-yellow-200 text-sm mb-2">
              Please ensure the lecturer is aware their password is being changed.
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                placeholder="Enter new password..."
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
              <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition" onClick={() => setShowResetPasswordModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-orange-600 rounded-lg hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition" onClick={handleResetPassword}>
                Reset Password
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedLecturer && (
        <ModalShell title={`Delete lecturer — ${selectedLecturer.name}`} onClose={() => setShowDeleteModal(false)}>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-200">
              <p className="font-bold mb-1">Warning: Irreversible Action</p>
              <p className="text-sm">
                Deleting this lecturer will unassign them from any classes they are currently teaching. This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
              <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition" onClick={handleDelete}>
                Delete Account
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ============================================================================
//                                HELPER COMPONENTS
// ============================================================================

/** Helper: Action Button with Tooltip */
function ActionButton({ onClick, icon, color, tooltip }: { onClick: () => void, icon: React.ReactNode, color: string, tooltip: string }) {
  return (
    <div className="relative group">
      <button onClick={onClick} className={`${color} hover:text-white transition p-1`}>
        {icon}
      </button>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {tooltip}
      </div>
    </div>
  );
}

// ---- Modal Shell ----

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-2xl relative">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl transition">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}