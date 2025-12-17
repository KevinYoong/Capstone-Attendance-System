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
  X,
  Plus, // <--- NEW IMPORT
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

interface ClassOption {
  class_id: number;
  class_name: string;
  course_code: string;
  lecturer_name?: string;
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
  
  // NEW: Enroll Modal State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Forms
  const [form, setForm] = useState({
    student_id: "",
    name: "",
    email: "",
    password: "",
  });

  // Fetch Students
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

  // Fetch Classes for Enrollment Modal
  const fetchClassesForModal = async (search = "") => {
    try {
      const res = await adminApi.get("/admin/classes", {
        params: { q: search, limit: 20 }, // Fetch top 20 matches
      });
      // The backend structure for /admin/classes might return { data: { classes: [] } }
      setAvailableClasses(res.data.data.classes || []);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
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

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // Drop Class Logic
  const handleDropClass = async (studentId: string, classId: number) => {
    if (!window.confirm("Are you sure you want to drop this student from the class?")) return;

    try {
      await adminApi.delete(`/admin/students/${studentId}/classes/${classId}`);
      setStudents((prev) =>
        prev.map((s) => {
          if (s.student_id === studentId && s.classes) {
            return {
              ...s,
              classes: s.classes.filter((c) => c.class_id !== classId),
            };
          }
          return s;
        })
      );
    } catch (err) {
      console.error("Drop class error:", err);
      alert("Failed to drop class");
    }
  };

  // Open Enroll Modal
  const openEnrollModal = (student: Student) => {
    setSelectedStudent(student);
    setAvailableClasses([]); // clear previous results
    fetchClassesForModal(""); // fetch initial list
    setShowEnrollModal(true);
  };

  // Submit Enrollment
  const submitEnroll = async (classId: number) => {
    if (!selectedStudent) return;
    try {
      const res = await adminApi.post(`/admin/students/${selectedStudent.student_id}/classes`, {
        class_id: classId
      });
      
      const newClass = res.data.data; // { class_id, class_name, course_code }

      // Update UI immediately
      setStudents(prev => prev.map(s => {
        if (s.student_id === selectedStudent.student_id) {
          return {
            ...s,
            classes: [...(s.classes || []), newClass]
          };
        }
        return s;
      }));

      setShowEnrollModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to enroll student");
    }
  };

  // ... (Other handlers: Create, Edit, Reset, Delete - kept same as before) ...
  const openCreate = () => {
    setSelectedStudent(null);
    setForm({ student_id: "", name: "", email: "", password: "" });
    setShowCreateModal(true);
  };
  const submitCreate = async () => { /* ... same as before ... */ };
  const openEdit = (s: Student) => {
    setSelectedStudent(s);
    setForm({ student_id: s.student_id, name: s.name, email: s.email, password: "" });
    setShowEditModal(true);
  };
  const submitEdit = async () => { /* ... same as before ... */ };
  const openReset = (s: Student) => {
    setSelectedStudent(s);
    setForm({ ...form, password: "" });
    setShowResetModal(true);
  };
  const submitReset = async () => { /* ... same as before ... */ };
  const openDelete = (s: Student) => {
    setSelectedStudent(s);
    setShowDeleteModal(true);
  };
  const submitDelete = async () => { /* ... same as before ... */ };

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
                          <button onClick={() => openEdit(st)} className="text-yellow-400 hover:text-yellow-300 transition" title="Edit Info"><Edit size={18} /></button>
                          <button onClick={() => openReset(st)} className="text-blue-400 hover:text-blue-300 transition" title="Reset Password"><KeyRound size={18} /></button>
                          <button onClick={() => openDelete(st)} className="text-red-400 hover:text-red-300 transition" title="Delete"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={5} className="p-4 pl-12">
                             <div className="flex justify-between items-center mb-2">
                               <h4 className="text-sm uppercase text-gray-500 font-bold">Enrolled Classes</h4>
                               <button 
                                 onClick={() => openEnrollModal(st)}
                                 className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition"
                               >
                                 <Plus size={12} /> Enroll in Class
                               </button>
                             </div>
                             
                             {enrolled.length === 0 ? (
                               <div className="text-gray-400 italic text-sm">No classes enrolled.</div>
                             ) : (
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {enrolled.map(c => (
                                    <div key={c.class_id} className="flex items-center justify-between bg-[#1f1f2f] p-2 rounded border border-white/5 hover:border-white/20 transition-colors">
                                      <div className="flex items-center gap-2 text-gray-300 text-sm overflow-hidden">
                                        <div className="w-1.5 h-1.5 flex-shrink-0 rounded-full bg-green-500"></div>
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-white">{c.course_code}</span>
                                          <span className="text-xs text-gray-400 truncate">{c.class_name}</span>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => handleDropClass(st.student_id, c.class_id)}
                                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/10 rounded transition"
                                        title="Drop class"
                                      >
                                        <X size={14} />
                                      </button>
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

      {/* Pagination (Same as before) */}
      <div className="flex justify-center items-center gap-4 mb-6">
        {/* ... pagination buttons ... */}
      </div>

      {/* Modals */}
      {showCreateModal && <CreateStudentModal form={form} setForm={setForm} onClose={() => setShowCreateModal(false)} onSubmit={submitCreate} />}
      {showEditModal && <EditStudentModal form={form} setForm={setForm} onClose={() => setShowEditModal(false)} onSubmit={submitEdit} />}
      {showResetModal && <ResetPasswordModal form={form} setForm={setForm} student={selectedStudent} onClose={() => setShowResetModal(false)} onSubmit={submitReset} />}
      {showDeleteModal && <DeleteModal student={selectedStudent} onClose={() => setShowDeleteModal(false)} onConfirm={submitDelete} />}

      {/* NEW: Enroll Modal */}
      {showEnrollModal && selectedStudent && (
        <EnrollClassModal 
          student={selectedStudent} 
          classes={availableClasses}
          onSearch={fetchClassesForModal} 
          onClose={() => setShowEnrollModal(false)} 
          onEnroll={submitEnroll} 
        />
      )}
    </div>
  );
}

// --------------------------------------------------------
// EnrollClassModal
// --------------------------------------------------------
function EnrollClassModal({ student, classes, onSearch, onClose, onEnroll }: any) {
  const [term, setTerm] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(term);
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-lg border border-white/10 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Enroll {student.name} into Class</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="mb-4">
           <input 
             placeholder="Search class by name or code..." 
             className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
             value={term}
             onChange={(e) => setTerm(e.target.value)}
             autoFocus
           />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {classes.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No classes found.</div>
          ) : (
            classes.map((cls: any) => {
              // Check if student is already enrolled (optional UI enhancement, requires checking props)
              const isEnrolled = student.classes?.some((c: any) => c.class_id === cls.class_id);
              
              return (
                <div key={cls.class_id} className="flex justify-between items-center bg-[#22222a] p-3 rounded-lg border border-white/5">
                  <div>
                    <div className="font-semibold text-white">{cls.course_code}</div>
                    <div className="text-sm text-gray-400">{cls.class_name}</div>
                    <div className="text-xs text-gray-500">{cls.lecturer_name || "No Lecturer"}</div>
                  </div>
                  {isEnrolled ? (
                     <span className="text-gray-500 text-xs font-semibold px-3 py-1 bg-white/5 rounded">Enrolled</span>
                  ) : (
                     <button 
                       onClick={() => onEnroll(cls.class_id)}
                       className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition"
                     >
                       Enroll
                     </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ... (Other Modals: CreateStudentModal, EditStudentModal, etc. remain unchanged) ...
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