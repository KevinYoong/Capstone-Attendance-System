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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    student_id: "",
    name: "",
    email: "",
    password: "",
  });

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
              order: sortOrder
            }
          });
          setStudents(res.data.data.students);
          setTotalItems(res.data.data.total);
        } catch (err) {
          console.error("Error fetching students:", err);
          setStudents([]); 
        } finally {
          setLoading(false);
        }
    }
    const timeoutId = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timeoutId);
  }, [currentPage, query, sortField, sortOrder]);

  // Dynamic Sort Icon Helper
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // ---------- CRUD Handlers ----------
  const handleCreateStudent = async () => {
    try {
      const payload = {
        student_id: formData.student_id,
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };

      const res = await adminApi.post("/admin/students", payload);
      setStudents((prev) => [res.data.data, ...prev]);

      setShowCreateModal(false);
    } catch (err) {
      console.error("Create student error:", err);
      alert("Failed to create student");
    }
  };

  const handleEditStudent = async () => {
    if (!selectedStudent) return;

    try {
      const res = await adminApi.put(
        `/admin/students/${selectedStudent.student_id}`,
        { name: formData.name }
      );

      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === selectedStudent.student_id ? res.data.data : s
        )
      );

      setShowEditModal(false);
      setSelectedStudent(null);
    } catch (err) {
      console.error("Edit student error:", err);
      alert("Failed to update student");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedStudent) return;

    try {
      await adminApi.post(
        `/admin/students/${selectedStudent.student_id}/reset-password`,
        { password: formData.password }
      );

      setShowResetModal(false);
      setSelectedStudent(null);
    } catch (err) {
      console.error("Reset password error:", err);
      alert("Failed to reset password");
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;

    try {
      await adminApi.delete(`/admin/students/${selectedStudent.student_id}`);

      setStudents((prev) =>
        prev.filter((s) => s.student_id !== selectedStudent.student_id)
      );

      setShowDeleteModal(false);
      setSelectedStudent(null);
    } catch (err) {
      console.error("Delete student error:", err);
      alert("Failed to delete student");
    }
  };

  return (
    <div className="p-8 text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Manage Students</h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by ID or Name..."
              className="pl-10 pr-4 py-2 bg-[#101010] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 w-full sm:w-64 transition"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <button
            onClick={() => {
              setFormData({ student_id: "", name: "", email: "", password: "" });
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <UserPlus size={18} /> <span className="hidden sm:inline">Add Student</span>
          </button>
        </div>
      </div>

      <div className="bg-[#181818]/80 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-[#1f1f2f] text-gray-300">
              <tr>
                {/* SORTABLE: Student ID */}
                <th 
                  className="py-4 px-6 text-center whitespace-nowrap cursor-pointer hover:bg-white/5 transition group"
                  onClick={() => handleSort("student_id")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Student ID
                    {renderSortIcon("student_id")}
                  </div>
                </th>

                {/* SORTABLE: Name */}
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
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No students found.</td></tr>
              ) : (
                students.map((student) => {
                  const isExpanded = expandedRows.has(student.student_id);
                  const classCount = student.classes?.length ?? 0;

                  return (
                    <React.Fragment key={student.student_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        <td className="py-4 px-6 text-center whitespace-nowrap font-medium text-white">
                          {student.student_id}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">{student.name}</td>
                        <td className="py-4 px-6 whitespace-nowrap">{student.email}</td>

                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleRow(student.student_id)}
                            className="inline-flex items-center justify-center gap-2 text-gray-300 hover:text-white transition"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {classCount} classes
                          </button>
                        </td>

                        <td className="py-4 px-6 flex justify-center gap-3 whitespace-nowrap">
                           <div className="relative group">
                              <button onClick={() => { setSelectedStudent(student); setFormData({ student_id: student.student_id, name: student.name, email: student.email, password: "" }); setShowEditModal(true); }} className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-white/10 rounded-lg transition">
                                <Edit size={18} />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Edit</div>
                            </div>

                            <div className="relative group">
                              <button onClick={() => { setSelectedStudent(student); setFormData({ ...formData, password: "" }); setShowResetModal(true); }} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-white/10 rounded-lg transition">
                                <KeyRound size={18} />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Reset Password</div>
                            </div>

                            <div className="relative group">
                              <button onClick={() => { setSelectedStudent(student); setShowDeleteModal(true); }} className="p-2 text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition">
                                <Trash2 size={18} />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Delete</div>
                            </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={5} className="p-4">
                            <div className="pl-10 text-left">
                              <h4 className="text-sm uppercase text-gray-500 font-bold mb-2">Enrolled Classes</h4>
                              {student.classes && student.classes.length > 0 ? (
                                <ul className="space-y-1 text-gray-300 text-md">
                                  {student.classes.map((c) => (
                                    <li key={c.class_id} className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                      <span className="font-medium text-sm text-white">{c.class_name}</span>
                                      {c.course_code && <span className="text-gray-500">({c.course_code})</span>}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-gray-500 italic">
                                  Not enrolled in any classes.
                                </p>
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

      <div className="flex justify-center items-center gap-4 mt-6">
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition">
          <ChevronLeft />
        </button>
        <p className="text-gray-300">Page <span className="font-bold text-white">{currentPage}</span> of {totalPages}</p>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition">
          <ChevronRight />
        </button>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <StudentModal
          title="Add Student"
          formData={formData}
          setFormData={setFormData}
          disableStudentId={false}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateStudent}
        />
      )}

      {showEditModal && selectedStudent && (
        <StudentModal
          title="Edit Student"
          formData={formData}
          setFormData={setFormData}
          disableStudentId={true}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditStudent}
        />
      )}

      {showResetModal && (
        <PasswordResetModal
          student={selectedStudent}
          newPassword={formData.password}
          setNewPassword={(pw: string) =>
            setFormData({ ...formData, password: pw })
          }
          onClose={() => setShowResetModal(false)}
          onSubmit={handleResetPassword}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          student={selectedStudent}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteStudent}
        />
      )}
    </div>
  );
}

/* -----------------------------------
   MODALS
------------------------------------ */

function StudentModal({
  title,
  formData,
  setFormData,
  onClose,
  onSubmit,
  disableStudentId,
}: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10">
        <h2 className="text-xl font-bold mb-4">{title}</h2>

        <div className="space-y-4">
          {!disableStudentId && (
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Student ID (8 digits)"
              value={formData.student_id}
              onChange={(e) =>
                setFormData({ ...formData, student_id: e.target.value })
              }
            />
          )}

          <input
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <input
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
            placeholder="Email Address"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          {!disableStudentId && (
            <input
              type="password"
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
            onClick={onSubmit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordResetModal({
  student,
  newPassword,
  setNewPassword,
  onClose,
  onSubmit,
}: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10">
        <h2 className="text-xl font-bold mb-4">
          Reset Password for {student?.name}
        </h2>

        <input
          type="password"
          className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
          placeholder="Enter New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500"
            onClick={onSubmit}
          >
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ student, onClose, onConfirm }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10">
        <h2 className="text-xl font-bold text-red-400 mb-4">
          Delete Student?
        </h2>

        <p className="text-gray-300 mb-4">
          Removing <b>{student?.name}</b> will also unenroll them from all
          enrolled classes.  
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}