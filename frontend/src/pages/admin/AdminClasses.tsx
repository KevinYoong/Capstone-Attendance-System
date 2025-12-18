import React, { useEffect, useMemo, useState } from "react";
import adminApi from "../../utils/adminApi";
import {
  Edit,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
} from "lucide-react";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface Lecturer {
  lecturer_id: number;
  name: string;
  email: string;
}

interface Student {
  student_id: number;
  name: string;
  email: string;
}

interface ClassItem {
  class_id: number;
  class_name: string;
  course_code: string;
  lecturer_id: number | null;
  lecturer_name?: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  start_week: number;
  end_week: number;
  class_type: "Lecture" | "Tutorial";
  students_enrolled: Student[];
}

// Form State Interface
interface ClassFormState {
  class_name: string;
  course_code: string;
  lecturer_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  start_week: number;
  end_week: number;
  class_type: string;
}

const ROWS_PER_PAGE = 10;

// ============================================================================
//                                MAIN COMPONENT
// ============================================================================

export default function AdminClasses() {
  // Data State
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [query, setQuery] = useState(""); 

  // Sorting
  const [sortField, setSortField] = useState<string>("class_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI State
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Modal Visibility
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Form State
  const [form, setForm] = useState<ClassFormState>({
    class_name: "",
    course_code: "",
    lecturer_id: 0,
    day_of_week: "Monday",
    start_time: "09:00",
    end_time: "10:00",
    start_week: 1,
    end_week: 14,
    class_type: "Lecture",
  });

  // Assign Student Modal State
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState<Set<number>>(new Set());

  // --------------------------------------------------------------------------
  //                                DATA LOADING
  // --------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch Classes with Pagination/Sort/Search
        const cRes = await adminApi.get("/admin/classes", {
          params: {
            q: query,
            page: currentPage,
            limit: ROWS_PER_PAGE,
            sortBy: sortField,
            order: sortOrder
          }
        });

        if (isMounted) {
          setClasses(cRes.data.data.classes || []);
          setTotalItems(cRes.data.data.total || 0);

          // Lazy load lecturers if not yet loaded
          if (lecturers.length === 0) {
            const lRes = await adminApi.get("/admin/lecturers");
            setLecturers(lRes.data.data.lecturers || []);
          }
          // Lazy load students if not yet loaded
          if (students.length === 0) {
            const sRes = await adminApi.get("/admin/students");
            setStudents((sRes.data.data.students || []).map((s: any) => ({
              student_id: Number(s.student_id),
              name: s.name,
              email: s.email
            })));
          }
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // Debounce search query to prevent excessive API calls
    const timeoutId = setTimeout(() => fetchData(), 300);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [currentPage, query, sortField, sortOrder]);

  // --------------------------------------------------------------------------
  //                                EVENT HANDLERS
  // --------------------------------------------------------------------------

  // Sorting Logic
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Row Expansion Logic
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // Create Handlers
  const openCreate = () => {
    setSelectedClass(null);
    setForm({
      class_name: "",
      course_code: "",
      lecturer_id: lecturers[0]?.lecturer_id ?? 0,
      day_of_week: "Monday",
      start_time: "09:00",
      end_time: "10:00",
      start_week: 1,
      end_week: 14,
      class_type: "Lecture",
    });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    try {
      const payload = { ...form, lecturer_id: Number(form.lecturer_id) };
      const res = await adminApi.post("/admin/classes", payload);
      
      const created = {
        ...res.data.data,
        lecturer_name: lecturers.find((l) => l.lecturer_id === payload.lecturer_id)?.name ?? "",
        students_enrolled: [],
      };
      setClasses((prev) => [created, ...prev]);
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create class");
    }
  };

  // Edit Handlers
  const openEdit = (cls: ClassItem) => {
    setSelectedClass(cls);
    setForm({
      class_name: cls.class_name,
      course_code: cls.course_code,
      lecturer_id: cls.lecturer_id ?? 0,
      day_of_week: cls.day_of_week,
      start_time: cls.start_time,
      end_time: cls.end_time,
      start_week: cls.start_week,
      end_week: cls.end_week,
      class_type: cls.class_type,
    });
    setShowEdit(true);
  };

  const submitEdit = async () => {
    if (!selectedClass) return;
    try {
      const payload = { ...form, lecturer_id: Number(form.lecturer_id) };
      const res = await adminApi.put(`/admin/classes/${selectedClass.class_id}`, payload);
      setClasses((prev) =>
        prev.map((c) =>
          c.class_id === selectedClass.class_id
            ? {
                ...res.data.data,
                lecturer_name: lecturers.find((l) => l.lecturer_id === payload.lecturer_id)?.name ?? "",
                students_enrolled: c.students_enrolled,
              }
            : c
        )
      );
      setShowEdit(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update class");
    }
  };

  // Delete Handlers
  const openDelete = (cls: ClassItem) => {
    setSelectedClass(cls);
    setShowDelete(true);
  };

  const submitDelete = async () => {
    if (!selectedClass) return;
    try {
      await adminApi.delete(`/admin/classes/${selectedClass.class_id}`);
      setClasses((prev) => prev.filter((c) => c.class_id !== selectedClass.class_id));
      setShowDelete(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete class");
    }
  };

  // Assignment Handlers
  const openAssign = (cls: ClassItem) => {
    setSelectedClass(cls);
    setAssignSearch("");
    setAssignSelected(new Set());
    setShowAssign(true);
  };

  const filteredStudents = useMemo(() => {
    const q = assignSearch.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        String(s.student_id).includes(q)
    );
  }, [students, assignSearch]);

  const submitAssign = async () => {
    if (!selectedClass) return;
    const ids = [...assignSelected];
    try {
      await adminApi.post(`/admin/classes/${selectedClass.class_id}/students`, {
        student_ids: ids,
      });
      const addedStudents = students.filter((s) => ids.includes(s.student_id));
      setClasses((prev) =>
        prev.map((c) =>
          c.class_id === selectedClass.class_id
            ? {
                ...c,
                students_enrolled: [
                  ...c.students_enrolled,
                  ...addedStudents.filter(
                    (s) => !c.students_enrolled.some((e) => e.student_id === s.student_id)
                  ),
                ],
              }
            : c
        )
      );
      setShowAssign(false);
    } catch (err) {
      console.error(err);
      alert("Failed to assign students");
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
    <div className="p-8 text-white">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Admin — Classes
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by name or code..."
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
            <Plus size={16} />
            <span className="hidden sm:inline">Create Class</span>
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
                  onClick={() => handleSort("class_name")}
                >
                  <div className="flex items-center gap-2">
                    Class Name
                    {renderSortIcon("class_name")}
                  </div>
                </th>
                <th 
                  className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap"
                  onClick={() => handleSort("course_code")}
                >
                  <div className="flex items-center gap-2">
                    Code
                    {renderSortIcon("course_code")}
                  </div>
                </th>
                <th className="p-4 whitespace-nowrap">Lecturer</th>
                <th className="p-4 whitespace-nowrap">Schedule</th>
                <th className="p-4 whitespace-nowrap text-center">Weeks</th>
                <th className="p-4 whitespace-nowrap text-center">Enrollment</th>
                <th className="p-4 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading data...</td></tr>
              ) : classes.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No classes found.</td></tr>
              ) : (
                classes.map((cls) => {
                  const isExpanded = expandedRows.has(cls.class_id);
                  return (
                    <React.Fragment key={cls.class_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        <td className="p-4 font-medium text-white">{cls.class_name}</td>
                        <td className="p-4">
                          <span className="bg-white/10 px-2 py-1 rounded text-xs text-white">
                            {cls.course_code}
                          </span>
                        </td>
                        <td className="p-4 text-sm">{cls.lecturer_name || <span className="text-gray-500 italic">Unassigned</span>}</td>
                        <td className="p-4 text-sm">
                          <div className="font-medium text-white">{cls.day_of_week}</div>
                          <div className="text-gray-400">{cls.start_time} – {cls.end_time}</div>
                        </td>
                        <td className="p-4 text-center text-sm">
                          {cls.start_week} - {cls.end_week}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleRow(cls.class_id)}
                            className="flex items-center justify-center gap-2 text-sm text-gray-300 hover:text-white transition w-full"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span>{cls.students_enrolled.length} Students</span>
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-center gap-2">
                            <ActionButton onClick={() => openEdit(cls)} icon={<Edit size={16} />} color="text-yellow-400" tooltip="Edit" />
                            <ActionButton onClick={() => openAssign(cls)} icon={<Users size={16} />} color="text-blue-400" tooltip="Assign" />
                            <ActionButton onClick={() => openDelete(cls)} icon={<Trash2 size={16} />} color="text-red-400" tooltip="Delete" />
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row for Students */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={7} className="p-4">
                            <div className="pl-6 border-l-2 border-blue-500/50 ml-4">
                                <h4 className="text-xs uppercase text-gray-500 font-bold mb-3">Enrolled Students List</h4>
                                {cls.students_enrolled.length === 0 ? (
                                  <div className="text-gray-500 italic text-sm">No students currently enrolled.</div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {cls.students_enrolled.map((s) => (
                                      <div key={s.student_id} className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 p-2 rounded">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                                        <span className="truncate">{s.name}</span>
                                        <span className="text-gray-500 text-xs ml-auto">({s.student_id})</span>
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

      {/* MODALS */}
      {showCreate && (
        <ModalShell title="Create New Class" onClose={() => setShowCreate(false)}>
          <ClassForm form={form} setForm={setForm} lecturers={lecturers} />
          <FormActions onCancel={() => setShowCreate(false)} onSubmit={submitCreate} submitText="Create Class" />
        </ModalShell>
      )}

      {showEdit && selectedClass && (
        <ModalShell title="Edit Class Details" onClose={() => setShowEdit(false)}>
          <ClassForm form={form} setForm={setForm} lecturers={lecturers} />
          <FormActions onCancel={() => setShowEdit(false)} onSubmit={submitEdit} submitText="Save Changes" />
        </ModalShell>
      )}

      {showAssign && selectedClass && (
        <ModalShell title={`Assign Students: ${selectedClass.class_name}`} onClose={() => setShowAssign(false)}>
          <AssignStudents 
            assignSearch={assignSearch} 
            setAssignSearch={setAssignSearch} 
            filteredStudents={filteredStudents} 
            assignSelected={assignSelected} 
            setAssignSelected={setAssignSelected} 
          />
          <FormActions onCancel={() => setShowAssign(false)} onSubmit={submitAssign} submitText="Confirm Assignment" />
        </ModalShell>
      )}

      {showDelete && selectedClass && (
        <ModalShell title="Delete Class" onClose={() => setShowDelete(false)}>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-200 mb-4">
            <p className="font-bold mb-1">Warning: Irreversible Action</p>
            <p className="text-sm">
              Are you sure you want to delete <b>{selectedClass.class_name}</b>?
              This will remove the class and unenroll all {selectedClass.students_enrolled.length} students.
            </p>
          </div>
          <FormActions onCancel={() => setShowDelete(false)} onSubmit={submitDelete} submitText="Delete Class" danger />
        </ModalShell>
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

// ---- Class Form ----

interface ClassFormProps {
  form: ClassFormState;
  setForm: React.Dispatch<React.SetStateAction<ClassFormState>>;
  lecturers: Lecturer[];
}

function ClassForm({ form, setForm, lecturers }: ClassFormProps) {
  return (
    <div className="space-y-4">
      {/* Name & Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Class Name</label>
          <input
            placeholder="e.g. Intro to Computing"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
            value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Course Code</label>
          <input
            placeholder="e.g. CSCP1014"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none transition"
            value={form.course_code}
            onChange={(e) => setForm({ ...form, course_code: e.target.value })}
          />
        </div>
      </div>

      {/* Lecturer & Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Lecturer</label>
          <select
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
            value={form.lecturer_id}
            onChange={(e) => setForm({ ...form, lecturer_id: Number(e.target.value) })}
          >
            <option value={0}>-- Select lecturer --</option>
            {lecturers.map((l) => (
              <option key={l.lecturer_id} value={l.lecturer_id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Class Type</label>
          <select
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
            value={form.class_type}
            onChange={(e) => setForm({ ...form, class_type: e.target.value })}
          >
            <option value="Lecture">Lecture</option>
            <option value="Tutorial">Tutorial</option>
          </select>
        </div>
      </div>

      {/* Schedule */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Schedule Day</label>
        <select
          className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
          value={form.day_of_week}
          onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
        >
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Time Range */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Start Time</label>
          <input
            type="time"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">End Time</label>
          <input
            type="time"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </div>
      </div>

      {/* Week Range */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Start Week</label>
          <input
            type="number"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
            value={form.start_week}
            min={1}
            max={14}
            onChange={(e) => setForm({ ...form, start_week: Number(e.target.value) })}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">End Week</label>
          <input
            type="number"
            className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
            value={form.end_week}
            min={1}
            max={14}
            onChange={(e) => setForm({ ...form, end_week: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Assign Students ----

interface AssignStudentsProps {
  assignSearch: string;
  setAssignSearch: React.Dispatch<React.SetStateAction<string>>;
  filteredStudents: Student[];
  assignSelected: Set<number>;
  setAssignSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
}

function AssignStudents({
  assignSearch,
  setAssignSearch,
  filteredStudents,
  assignSelected,
  setAssignSelected,
}: AssignStudentsProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
        <input
          placeholder="Search students to enroll..."
          value={assignSearch}
          onChange={(e) => setAssignSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-3 bg-[#101010] border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredStudents.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No students found.</p>
        ) : (
          filteredStudents.map((s) => (
            <label
              key={s.student_id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                assignSelected.has(s.student_id) 
                  ? "bg-blue-600/10 border-blue-500/50" 
                  : "bg-[#111] border-white/5 hover:bg-white/5"
              }`}
            >
              <input
                type="checkbox"
                checked={assignSelected.has(s.student_id)}
                onChange={(e) => {
                  const next = new Set(assignSelected);
                  e.target.checked ? next.add(s.student_id) : next.delete(s.student_id);
                  setAssignSelected(next);
                }}
                className="accent-blue-600 w-4 h-4"
              />
              <div>
                <div className="text-sm font-medium text-white">{s.name}</div>
                <div className="text-xs text-gray-400">
                  ID: {s.student_id} • {s.email}
                </div>
              </div>
            </label>
          ))
        )}
      </div>
      
      <div className="text-xs text-gray-500 text-right">
        {assignSelected.size} students selected
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-xl border border-white/10 shadow-2xl relative">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Form Actions ----

interface FormActionsProps {
  onCancel: () => void;
  onSubmit: () => void;
  submitText: string;
  danger?: boolean;
}

function FormActions({ onCancel, onSubmit, submitText, danger }: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
      <button 
        onClick={onCancel} 
        className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        className={`px-4 py-2 rounded-lg font-medium transition shadow-lg ${
          danger 
            ? "bg-red-600 hover:bg-red-500 shadow-red-500/20 text-white" 
            : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 text-white"
        }`}
      >
        {submitText}
      </button>
    </div>
  );
}