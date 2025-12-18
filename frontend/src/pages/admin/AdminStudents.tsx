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
  Plus,
} from "lucide-react";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

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

interface StudentForm {
  student_id: string;
  name: string;
  email: string;
  password?: string;
}

const ROWS_PER_PAGE = 10;

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

export default function AdminStudents() {
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [query, setQuery] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<string>("student_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI State
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Modal Visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // Form State
  const [form, setForm] = useState<StudentForm>({
    student_id: "",
    name: "",
    email: "",
    password: "",
  });

  // --------------------------------------------------------------------------
  //                                DATA LOADING
  // --------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;
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
        if (isMounted) {
          setStudents(res.data.data.students || []);
          setTotalItems(res.data.data.total || 0);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    const timer = setTimeout(() => fetchData(), 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentPage, query, sortField, sortOrder]);

  /** Fetches classes to show in the enrollment search modal */
  const fetchClassesForModal = async (search = "") => {
    try {
      const res = await adminApi.get("/admin/classes", {
        params: { q: search, limit: 20 },
      });
      setAvailableClasses(res.data.data.classes || []);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

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

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // ---- Enrollment Logic ----

  const openEnrollModal = (student: Student) => {
    setSelectedStudent(student);
    setAvailableClasses([]);
    fetchClassesForModal("");
    setShowEnrollModal(true);
  };

  const submitEnroll = async (classId: number) => {
    if (!selectedStudent) return;
    try {
      const res = await adminApi.post(`/admin/students/${selectedStudent.student_id}/classes`, {
        class_id: classId
      });
      const newClass = res.data.data;
      setStudents(prev => prev.map(s => {
        if (s.student_id === selectedStudent.student_id) {
          return { ...s, classes: [...(s.classes || []), newClass] };
        }
        return s;
      }));
      setShowEnrollModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to enroll student");
    }
  };

  const handleDropClass = async (studentId: string, classId: number) => {
    if (!window.confirm("Are you sure you want to drop this student from the class?")) return;
    try {
      await adminApi.delete(`/admin/students/${studentId}/classes/${classId}`);
      setStudents((prev) =>
        prev.map((s) => {
          if (s.student_id === studentId && s.classes) {
            return { ...s, classes: s.classes.filter((c) => c.class_id !== classId) };
          }
          return s;
        })
      );
    } catch (err) {
      console.error("Drop class error:", err);
      alert("Failed to drop class");
    }
  };

  // ---- CRUD Handlers ----

  const openCreate = () => {
    setSelectedStudent(null);
    setForm({ student_id: "", name: "", email: "", password: "" });
    setShowCreateModal(true);
  };

  const submitCreate = async () => {
    try {
      await adminApi.post("/admin/students", form);
      // Refresh list
      const res = await adminApi.get("/admin/students", { params: { q: query, page: currentPage, limit: ROWS_PER_PAGE, sortBy: sortField, order: sortOrder } });
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
    setForm({ student_id: s.student_id, name: s.name, email: s.email });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!selectedStudent) return;
    try {
      await adminApi.put(`/admin/students/${selectedStudent.student_id}`, form);
      setStudents((prev) => prev.map((s) => s.student_id === selectedStudent.student_id ? { ...s, name: form.name, email: form.email } : s));
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
      await adminApi.post(`/admin/students/${selectedStudent.student_id}/reset-password`, { password: form.password });
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
      setStudents((prev) => prev.filter((s) => s.student_id !== selectedStudent.student_id));
      setShowDeleteModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete student");
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Admin — Students
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search ID, name, email..."
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
            <span className="hidden sm:inline font-medium">Add Student</span>
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden mb-6 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-[#1f1f2f] text-gray-300 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap" onClick={() => handleSort("student_id")}>
                  <div className="flex items-center gap-2">ID {renderSortIcon("student_id")}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-2">Name {renderSortIcon("name")}</div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap" onClick={() => handleSort("email")}>
                  <div className="flex items-center gap-2">Email {renderSortIcon("email")}</div>
                </th>
                <th className="p-4 text-center">Enrollment</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading data...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">No students found.</td></tr>
              ) : (
                students.map((st) => {
                  const isExpanded = expandedRows.has(st.student_id);
                  const enrolled = st.classes || [];
                  return (
                    <React.Fragment key={st.student_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        <td className="p-4 font-mono text-gray-400 text-sm">#{st.student_id}</td>
                        <td className="p-4 font-medium text-white">{st.name}</td>
                        <td className="p-4 text-gray-300">{st.email}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleRow(st.student_id)}
                            className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-300 hover:text-white transition group"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span className="group-hover:underline decoration-blue-500/50 underline-offset-4">
                              {enrolled.length} Classes
                            </span>
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <ActionButton onClick={() => openEdit(st)} icon={<Edit size={18} />} color="text-yellow-400" tooltip="Edit Info" />
                            <ActionButton onClick={() => openReset(st)} icon={<KeyRound size={18} />} color="text-blue-400" tooltip="Reset Password" />
                            <ActionButton onClick={() => openDelete(st)} icon={<Trash2 size={18} />} color="text-red-400" tooltip="Delete Account" />
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Enrollment List */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={5} className="p-4">
                             <div className="pl-12 border-l-2 border-blue-500/50 ml-8">
                               <div className="flex justify-between items-center mb-3">
                                 <h4 className="text-xs uppercase text-gray-500 font-bold">Enrolled Classes</h4>
                                 <button 
                                   onClick={() => openEnrollModal(st)}
                                   className="flex items-center gap-1 text-[10px] uppercase font-bold bg-green-600/10 hover:bg-green-600 border border-green-600/50 text-green-400 hover:text-white px-3 py-1 rounded transition"
                                 >
                                   <Plus size={12} /> Enroll in Class
                                 </button>
                               </div>
                               
                               {enrolled.length === 0 ? (
                                 <div className="text-gray-500 italic text-sm">Not enrolled in any classes.</div>
                               ) : (
                                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {enrolled.map(c => (
                                      <div key={c.class_id} className="flex items-center justify-between bg-[#1f1f2f] p-2 rounded border border-white/5 group/class">
                                        <div className="flex items-center gap-2 text-gray-300 text-sm overflow-hidden">
                                          <div className="w-1.5 h-1.5 flex-shrink-0 rounded-full bg-green-500"></div>
                                          <div className="flex flex-col overflow-hidden">
                                            <span className="font-bold text-white text-xs">{c.course_code}</span>
                                            <span className="text-[11px] text-gray-400 truncate">{c.class_name}</span>
                                          </div>
                                        </div>
                                        <button 
                                          onClick={() => handleDropClass(st.student_id, c.class_id)}
                                          className="p-1 text-gray-600 hover:text-red-400 transition"
                                          title="Drop class"
                                        >
                                          <X size={14} />
                                        </button>
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

      {/* Pagination Section */}
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
      
      {showCreateModal && (
        <GenericModal title="Create New Student" onClose={() => setShowCreateModal(false)} onSubmit={submitCreate} submitText="Create Student">
          <StudentFormFields form={form} setForm={setForm} isCreate={true} />
        </GenericModal>
      )}

      {showEditModal && (
        <GenericModal title="Edit Student Profile" onClose={() => setShowEditModal(false)} onSubmit={submitEdit} submitText="Save Changes">
          <StudentFormFields form={form} setForm={setForm} isCreate={false} />
        </GenericModal>
      )}

      {showResetModal && (
        <GenericModal title={`Reset Password — ${selectedStudent?.name}`} onClose={() => setShowResetModal(false)} onSubmit={submitReset} submitText="Confirm Reset">
           <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                placeholder="Enter new password..."
                className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
        </GenericModal>
      )}

      {showDeleteModal && (
        <GenericModal title="Delete Student" onClose={() => setShowDeleteModal(false)} onSubmit={submitDelete} submitText="Delete Student" danger={true}>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-200">
            <p className="font-bold mb-1">Warning: Irreversible Action</p>
            <p className="text-sm">
              Removing <b>{selectedStudent?.name}</b> will unenroll them from all classes. This action cannot be undone.
            </p>
          </div>
        </GenericModal>
      )}

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

// ============================================================================
//                                SUB-COMPONENTS
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

/** Fields for Create/Edit Modal */
function StudentFormFields({ form, setForm, isCreate }: { form: StudentForm, setForm: any, isCreate: boolean }) {
  return (
    <div className="space-y-4">
      {isCreate && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Student ID</label>
          <input
            placeholder="e.g. 21012345"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
            value={form.student_id}
            onChange={(e) => setForm({ ...form, student_id: e.target.value })}
          />
        </div>
      )}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Full Name</label>
        <input
          placeholder="e.g. John Doe"
          className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Email Address</label>
        <input
          placeholder="e.g. im.student@imail.sunway.edu.my"
          className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      {isCreate && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Initial Password</label>
          <input
            type="password"
            placeholder="Initial password"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/** Reusable Generic Modal */
function GenericModal({ title, onClose, onSubmit, submitText, children, danger = false }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-md border border-white/10 shadow-2xl relative">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">✕</button>
        </div>

        {children}

        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/10">
          <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition" onClick={onClose}>
            Cancel
          </button>
          <button 
            className={`px-4 py-2 rounded-lg font-medium transition shadow-lg ${danger ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'}`}
            onClick={onSubmit}
          >
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Searchable Modal for Enrollment */
function EnrollClassModal({ student, classes, onSearch, onClose, onEnroll }: any) {
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(term), 300);
    return () => clearTimeout(timer);
  }, [term]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-lg border border-white/10 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Enroll: {student.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">✕</button>
        </div>

        <div className="mb-4 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
           <input 
             placeholder="Search class by name or code..." 
             className="w-full pl-9 pr-3 py-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
             value={term}
             onChange={(e) => setTerm(e.target.value)}
             autoFocus
           />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {classes.length === 0 ? (
            <div className="text-gray-500 text-center py-10">No classes found matching your search.</div>
          ) : (
            classes.map((cls: any) => {
              const isEnrolled = student.classes?.some((c: any) => c.class_id === cls.class_id);
              return (
                <div key={cls.class_id} className="flex justify-between items-center bg-[#111] p-3 rounded-lg border border-white/5 hover:border-white/10 transition">
                  <div className="flex flex-col">
                    <div className="font-bold text-white text-xs">{cls.course_code}</div>
                    <div className="text-[11px] text-gray-400">{cls.class_name}</div>
                    <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-tight">{cls.lecturer_name || "Unassigned"}</div>
                  </div>
                  {isEnrolled ? (
                     <span className="text-[10px] uppercase font-bold text-gray-500 px-3 py-1 bg-white/5 rounded">Enrolled</span>
                  ) : (
                     <button 
                       onClick={() => onEnroll(cls.class_id)}
                       className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition shadow-lg shadow-blue-500/20"
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