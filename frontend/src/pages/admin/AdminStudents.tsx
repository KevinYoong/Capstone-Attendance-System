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
  Search,
  ArrowUpDown,
} from "lucide-react";

interface EnrolledClass {
  class_id: number;
  class_name: string;
  course_code?: string;
}

interface Student {
  student_id: string;
  name: string;
  email: string;
  classes?: EnrolledClass[];
}

const ROWS_PER_PAGE = 10;

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [query, setQuery] = useState("");

  const [sortField, setSortField] = useState<string>("student_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Forms
  const [form, setForm] = useState({
    student_id: "",
    name: "",
    email: "",
    password: "",
  });

  // Fetch
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await adminApi.get("/admin/students", {
          params: {
            q: query,
            page: currentPage,
            limit: ROWS_PER_PAGE,
            sortBy: sortField,
            order: sortOrder,
          },
        });
        setStudents(res.data.data.students || []);
        setTotalItems(res.data.data.total || 0);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [currentPage, query, sortField, sortOrder]);

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

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // Handlers
  const openCreate = () => {
    setSelectedStudent(null);
    setForm({ student_id: "", name: "", email: "", password: "" });
    setShowCreateModal(true);
  };

  const submitCreate = async () => {
    try {
      await adminApi.post("/admin/students", {
        student_id: form.student_id,
        name: form.name,
        email: form.email,
        password: form.password,
      });
      // refresh
      const res = await adminApi.get("/admin/students", {
        params: { q: query, page: currentPage, limit: ROWS_PER_PAGE, sortBy: sortField, order: sortOrder },
      });
      setStudents(res.data.data.students || []);
      setTotalItems(res.data.data.total || 0);
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create student");
    }
  };

  const openEdit = (s: Student) => {
    setSelectedStudent(s);
    setForm({
      student_id: s.student_id,
      name: s.name,
      email: s.email,
      password: "",
    });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!selectedStudent) return;
    try {
      // Don't send student_id as primary key usually doesn't change
      await adminApi.put(`/admin/students/${selectedStudent.student_id}`, {
        name: form.name,
        email: form.email,
      });
      setStudents((prev) =>
        prev.map((st) =>
          st.student_id === selectedStudent.student_id
            ? { ...st, name: form.name, email: form.email }
            : st
        )
      );
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update student");
    }
  };

  const openReset = (s: Student) => {
    setSelectedStudent(s);
    setForm({ ...form, password: "" });
    setShowResetModal(true);
  };

  const submitReset = async () => {
    if (!selectedStudent) return;
    try {
      await adminApi.put(`/admin/students/${selectedStudent.student_id}/password`, {
        password: form.password,
      });
      alert("Password reset successfully");
      setShowResetModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to reset password");
    }
  };

  const openDelete = (s: Student) => {
    setSelectedStudent(s);
    setShowDeleteModal(true);
  };

  const submitDelete = async () => {
    if (!selectedStudent) return;
    try {
      await adminApi.delete(`/admin/students/${selectedStudent.student_id}`);
      setStudents((prev) => prev.filter((st) => st.student_id !== selectedStudent.student_id));
      setShowDeleteModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete student");
    }
  };

  return (
    <div className="p-8 text-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Admin — Students</h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by ID, name, email..."
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
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add Student</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-[#1f1f2f] text-gray-300">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap" onClick={() => handleSort("student_id")}>
                  <div className="flex items-center gap-2">Student ID {renderSortIcon("student_id")}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-2">Name {renderSortIcon("name")}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap" onClick={() => handleSort("email")}>
                  <div className="flex items-center gap-2">Email {renderSortIcon("email")}</div>
                </th>
                <th className="p-4 text-center">Classes</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No students found.</td></tr>
              ) : (
                students.map((st) => {
                  const isExpanded = expandedRows.has(st.student_id);
                  const enrolled = st.classes || [];
                  return (
                    <React.Fragment key={st.student_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        <td className="p-4 font-mono text-gray-400 text-sm">{st.student_id}</td>
                        <td className="p-4 font-medium text-white">{st.name}</td>
                        <td className="p-4">{st.email}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleRow(st.student_id)}
                            className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-300 hover:text-white transition"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span>{enrolled.length} Enrolled</span>
                          </button>
                        </td>
                        <td className="p-4 text-center flex justify-center gap-3">
                          <button onClick={() => openEdit(st)} className="text-yellow-400 hover:text-yellow-300 transition" title="Edit Info">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => openReset(st)} className="text-blue-400 hover:text-blue-300 transition" title="Reset Password">
                            <KeyRound size={18} />
                          </button>
                          <button onClick={() => openDelete(st)} className="text-red-400 hover:text-red-300 transition" title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={5} className="p-4 pl-12">
                             <h4 className="text-sm uppercase text-gray-500 font-bold mb-2">Enrolled Classes</h4>
                             {enrolled.length === 0 ? (
                               <div className="text-gray-400 italic text-sm">No classes enrolled.</div>
                             ) : (
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {enrolled.map(c => (
                                    <div key={c.class_id} className="flex items-center gap-2 text-gray-300 text-sm">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                      <span className="font-semibold text-white">{c.course_code}</span>
                                      <span>— {c.class_name}</span>
                                    </div>
                                  ))}
                               </div>
                             )}
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

      <div className="flex justify-center items-center gap-4 mb-6">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <ChevronLeft />
        </button>
        <p className="text-gray-300">
          Page <span className="font-bold text-white">{currentPage}</span> of {totalPages}
        </p>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateStudentModal
          form={form}
          setForm={setForm}
          onClose={() => setShowCreateModal(false)}
          onSubmit={submitCreate}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditStudentModal
          form={form}
          setForm={setForm}
          onClose={() => setShowEditModal(false)}
          onSubmit={submitEdit}
        />
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <ResetPasswordModal
          form={form}
          setForm={setForm}
          student={selectedStudent}
          onClose={() => setShowResetModal(false)}
          onSubmit={submitReset}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteModal
          student={selectedStudent}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={submitDelete}
        />
      )}
    </div>
  );
}

/* -----------------------------
   MODAL COMPONENTS (Refactored)
----------------------------- */

function CreateStudentModal({ form, setForm, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Create New Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Student ID</label>
            <input
              placeholder="e.g. 21012345"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full Name</label>
            <input
              placeholder="e.g. John Doe"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Address</label>
            <input
              placeholder="e.g. im.student@imail.sunway.edu.my"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              placeholder="Initial password"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500" onClick={onSubmit}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditStudentModal({ form, setForm, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Edit Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full Name</label>
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Address</label>
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500" onClick={onSubmit}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ form, setForm, student, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Reset Password — {student?.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">New Password</label>
          <input
            type="password"
            placeholder="Enter new password..."
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-orange-600 rounded-lg hover:bg-orange-500" onClick={onSubmit}>
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ student, onClose, onConfirm }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-red-400">Delete Student?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <p className="text-gray-300 mb-4">
          Removing <b>{student?.name}</b> will also unenroll them from all enrolled classes.
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <button className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500" onClick={onConfirm}>
            Delete Student
          </button>
        </div>
      </div>
    </div>
  );
}