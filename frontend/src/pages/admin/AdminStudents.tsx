import { useEffect, useState } from "react";
import {
  UserPlus,
  Edit,
  Trash2,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Student {
  student_id: string;
  name: string;
  email: string;
  phone_number?: string;
  classes_enrolled?: number; // backend will eventually send this
}

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination
  const ROWS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    student_id: "",
    name: "",
    email: "",
    phone_number: "",
    password: "",
  });

  // Fetch students (mock now → backend later)
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        // TEMPORARY: Replace with backend call later
        const mockData: Student[] = [
          {
            student_id: "11223344",
            name: "John Tan",
            email: "john@university.edu",
            phone_number: "0123456789",
            classes_enrolled: 5,
          },
          {
            student_id: "11223345",
            name: "Aida Musa",
            email: "aida@university.edu",
            phone_number: "0115552222",
            classes_enrolled: 3,
          },
        ];

        setStudents(mockData);
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Pagination logic
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedStudents = students.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const totalPages = Math.ceil(students.length / ROWS_PER_PAGE);

  // Handlers
  const openCreateModal = () => {
    setFormData({
      student_id: "",
      name: "",
      email: "",
      phone_number: "",
      password: "",
    });
    setShowCreateModal(true);
  };

  const openEditModal = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      student_id: student.student_id,
      name: student.name,
      email: student.email,
      phone_number: student.phone_number || "",
      password: "",
    });
    setShowEditModal(true);
  };

  const openResetModal = (student: Student) => {
    setSelectedStudent(student);
    setFormData({ ...formData, password: "" });
    setShowResetModal(true);
  };

  const openDeleteModal = (student: Student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manage Students</h1>
        <button
          onClick={openCreateModal}
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
              <th className="p-4 text-center">Classes Enrolled</th>
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
              paginatedStudents.map((student) => (
                <tr
                  key={student.student_id}
                  className="border-t border-white/5 hover:bg-[#222233]"
                >
                  <td className="p-4">{student.student_id}</td>
                  <td className="p-4">{student.name}</td>
                  <td className="p-4">{student.email}</td>
                  <td className="p-4 text-center">{student.classes_enrolled}</td>

                  <td className="p-4 flex justify-center gap-3">
                    <button
                      onClick={() => openEditModal(student)}
                      className="text-yellow-400 hover:text-yellow-300"
                    >
                      <Edit size={18} />
                    </button>

                    <button
                      onClick={() => openResetModal(student)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <KeyRound size={18} />
                    </button>

                    <button
                      onClick={() => openDeleteModal(student)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
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
          onClose={() => setShowCreateModal(false)}
          onSubmit={() => {}}
        />
      )}

      {showEditModal && selectedStudent && (
        <StudentModal
          title="Edit Student"
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowEditModal(false)}
          onSubmit={() => {}}
          disableStudentId
        />
      )}

      {showResetModal && (
        <PasswordResetModal
          student={selectedStudent}
          newPassword={formData.password}
          setNewPassword={(pw: string) => setFormData({ ...formData, password: pw })}
          onClose={() => setShowResetModal(false)}
          onSubmit={() => {}}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          student={selectedStudent}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => {}}
        />
      )}
    </div>
  );
}

/* ------------------------------
   MODALS COMPONENTS
--------------------------------*/

function StudentModal({
  title,
  formData,
  setFormData,
  onClose,
  onSubmit,
  disableStudentId = false,
}: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10">
        <h2 className="text-xl font-bold mb-4">{title}</h2>

        <div className="space-y-4">
          {!disableStudentId && (
            <input
              className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
              placeholder="Student ID"
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
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <input
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
            placeholder="Phone Number"
            value={formData.phone_number}
            onChange={(e) =>
              setFormData({ ...formData, phone_number: e.target.value })
            }
          />

          {/* Password only appears when adding */}
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

function PasswordResetModal({ student, newPassword, setNewPassword, onClose, onSubmit }: any) {
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
          current classes.  
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