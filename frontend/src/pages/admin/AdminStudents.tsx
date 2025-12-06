import { useEffect, useState } from "react";
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


// ---------- Types ----------
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

const ROWS_PER_PAGE = 25;

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Expanded rows (class dropdown)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    student_id: "",
    name: "",
    email: "",
    password: "",
  });

  // ---------- Load Students ----------
  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        

        try {
        const res = await adminApi.get("/admin/students");
        setStudents(res.data.data.students);
        } catch (err) {
        console.error("Error fetching students:", err);
        setStudents([]);             // Prevent crash
        } finally {
        setLoading(false);
        }
    }

    fetchData();
  }, []);

  // Pagination
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedStudents = students.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(students.length / ROWS_PER_PAGE));

  // Expand/collapse class list
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manage Students</h1>

        <button
          onClick={() => {
            setFormData({ student_id: "", name: "", email: "", password: "" });
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center gap-2"
        >
          <UserPlus size={18} /> Add Student
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#1f1f2f] text-gray-300">
            <tr>
              <th className="p-4">Student ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4 text-center">Classes</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  No students found.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student) => {
                const isExpanded = expandedRows.has(student.student_id);

                return (
                  <>
                    <tr
                      key={student.student_id}
                      className="border-t border-white/5 hover:bg-[#222233]"
                    >
                      <td className="p-4">{student.student_id}</td>
                      <td className="p-4">{student.name}</td>
                      <td className="p-4">{student.email}</td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleRow(student.student_id)}
                          className="flex items-center justify-center gap-2 text-gray-300 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {(student.classes?.length ?? 0) + " classes"}
                        </button>
                      </td>

                      <td className="p-4 flex justify-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setFormData({
                              student_id: student.student_id,
                              name: student.name,
                              email: student.email,
                              password: "",
                            });
                            setShowEditModal(true);
                          }}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          <Edit size={18} />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setFormData({ ...formData, password: "" });
                            setShowResetModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <KeyRound size={18} />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded class list */}
                    {isExpanded && (
                      <tr className="bg-[#15151b] border-t border-white/5">
                        <td colSpan={5} className="p-4">
                          {student.classes && student.classes.length > 0 ? (
                            <ul className="space-y-1 text-gray-300">
                              {student.classes.map((c) => (
                                <li key={c.class_id}>
                                  • {c.class_name}
                                  {c.course_code ? ` (${c.course_code})` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-400 italic">
                              Not enrolled in any classes.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
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