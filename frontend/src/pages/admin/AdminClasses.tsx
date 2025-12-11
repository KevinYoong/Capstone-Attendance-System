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

/* -----------------------------
   Types aligned to backend
----------------------------- */

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
  // Updated: this comes populated from backend now
  students_enrolled: Student[];
}

const ROWS_PER_PAGE = 10;

/* -----------------------------
   MAIN COMPONENT
----------------------------- */
export default function AdminClasses() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering (Server-Side)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [query, setQuery] = useState(""); // Searches Class Name & Course Code

  // Sorting
  const [sortField, setSortField] = useState<string>("class_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Create / Edit / Assign / Delete modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Create/Edit Form
  const [form, setForm] = useState({
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

  // Assign modal
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState<Set<number>>(new Set());

  /* -----------------------------
     Load Data (Server Side for Classes)
  ----------------------------- */
  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        try {
            // 1. Fetch Classes (Paginated/Sorted/Filtered)
            const cRes = await adminApi.get("/admin/classes", {
                params: {
                    q: query,
                    page: currentPage,
                    limit: ROWS_PER_PAGE,
                    sortBy: sortField,
                    order: sortOrder
                }
            });
            setClasses(cRes.data.data.classes || []);
            setTotalItems(cRes.data.data.total || 0);

            // 2. Fetch full lists of lecturers & students ONCE (for modals)
            // Optimization: In a real large app, you might only fetch these when opening the modal.
            // For now, keeping your existing pattern but separating it from the table reload would be better
            // IF we hadn't put it in the same useEffect.
            // Let's optimize: Only fetch lecturers/students if lists are empty.
            if (lecturers.length === 0) {
               const lRes = await adminApi.get("/admin/lecturers");
               setLecturers(lRes.data.data.lecturers || []);
            }
            if (students.length === 0) {
               const sRes = await adminApi.get("/admin/students");
               setStudents((sRes.data.data.students || []).map((s: any) => ({
                   student_id: Number(s.student_id),
                   name: s.name,
                   email: s.email
               })));
            }

        } catch (err) {
            console.error("Load error:", err);
        } finally {
            setLoading(false);
        }
    }
    const timeoutId = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timeoutId);
  }, [currentPage, query, sortField, sortOrder]); // Trigger on sort/page/search change

  /* -----------------------------
     Sorting Helpers
  ----------------------------- */
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
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  /* -----------------------------
     Handlers — Create
  ----------------------------- */
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
      // Re-fetch to see new class respecting sort/page
      // Alternatively, insert locally if on page 1. For simplicity, just reload or rely on useEffect logic if we reset state.
      // Easiest is to just add to local state if sort is 'desc' and field is 'class_id'.
      // Let's just rely on a re-fetch or a simple prepend.
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

  /* -----------------------------
     Handlers — Edit
  ----------------------------- */
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

  /* -----------------------------
     Handlers — Delete
  ----------------------------- */
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

  /* -----------------------------
     Handlers — Assign Students
  ----------------------------- */
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

  /* -----------------------------
     Render
  ----------------------------- */
  return (
    <div className="p-8 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Admin — Classes</h1>

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
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Create Class</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-[#1f1f2f] text-gray-300">
              <tr>
                {/* Sortable Class Name */}
                <th 
                  className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap"
                  onClick={() => handleSort("class_name")}
                >
                  <div className="flex items-center gap-2">
                    Class Name
                    {renderSortIcon("class_name")}
                  </div>
                </th>

                {/* Sortable Course Code */}
                <th 
                  className="p-4 cursor-pointer hover:bg-white/5 transition group whitespace-nowrap"
                  onClick={() => handleSort("course_code")}
                >
                  <div className="flex items-center gap-2">
                    Course Code
                    {renderSortIcon("course_code")}
                  </div>
                </th>

                <th className="p-4 whitespace-nowrap">Lecturer</th>
                <th className="p-4 whitespace-nowrap">Day & Time</th>
                <th className="p-4 whitespace-nowrap text-center">Weeks</th>
                <th className="p-4 whitespace-nowrap text-center">Students</th>
                <th className="p-4 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Loading...</td></tr>
              ) : classes.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">No classes found.</td></tr>
              ) : (
                classes.map((cls) => {
                  const isExpanded = expandedRows.has(cls.class_id);

                  return (
                    // React.Fragment fixes the nesting layout issue
                    <React.Fragment key={cls.class_id}>
                      <tr className="border-t border-white/5 hover:bg-[#222233] transition-colors">
                        <td className="p-4 font-medium text-white">{cls.class_name}</td>
                        <td className="p-4">{cls.course_code}</td>

                        <td className="p-4">
                          {cls.lecturer_name || "—"}
                        </td>

                        <td className="p-4">
                          {cls.day_of_week}
                          <br />
                          <span className="text-gray-400 text-sm">
                            {cls.start_time}–{cls.end_time}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          Week {cls.start_week}–{cls.end_week}
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleRow(cls.class_id)}
                            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span>{cls.students_enrolled.length} students</span>
                          </button>
                        </td>

                        <td className="p-4 text-right flex justify-center gap-3">
                          
                          {/* Edit Button with Tooltip */}
                          <div className="relative group">
                            <button onClick={() => openEdit(cls)} className="text-yellow-400 hover:text-yellow-300 transition">
                              <Edit size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Edit</div>
                          </div>

                          {/* Assign Button with Tooltip */}
                          <div className="relative group">
                            <button onClick={() => openAssign(cls)} className="text-blue-400 hover:text-blue-300 transition">
                              <Users size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Assign</div>
                          </div>

                          {/* Delete Button with Tooltip */}
                          <div className="relative group">
                            <button onClick={() => openDelete(cls)} className="text-red-400 hover:text-red-300 transition">
                              <Trash2 size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Delete</div>
                          </div>

                        </td>
                      </tr>

                      {/* Expanded Student List */}
                      {isExpanded && (
                        <tr className="bg-[#15151b] border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          <td colSpan={7} className="p-4">
                            <div className="pl-6">
                                <h4 className="text-sm uppercase text-gray-500 font-bold mb-2">Enrolled Students</h4>
                                {cls.students_enrolled.length === 0 ? (
                                  <div className="text-gray-400 italic text-sm">No students enrolled.</div>
                                ) : (
                                  <ul className="space-y-1 text-gray-300 text-md">
                                    {cls.students_enrolled.map((s) => (
                                      <li key={s.student_id} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        {s.name} <span className="text-gray-500">({s.student_id})</span>
                                      </li>
                                    ))}
                                  </ul>
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

      {/* ---------- CREATE MODAL (Unchanged) ---------- */}
      {showCreate && (
        <ModalShell title="Create Class" onClose={() => setShowCreate(false)}>
          <ClassForm form={form} setForm={setForm} lecturers={lecturers} />
          <FormActions onCancel={() => setShowCreate(false)} onSubmit={submitCreate} submitText="Create" />
        </ModalShell>
      )}

      {/* ---------- EDIT MODAL (Unchanged) ---------- */}
      {showEdit && selectedClass && (
        <ModalShell title="Edit Class" onClose={() => setShowEdit(false)}>
          <ClassForm form={form} setForm={setForm} lecturers={lecturers} />
          <FormActions onCancel={() => setShowEdit(false)} onSubmit={submitEdit} submitText="Save" />
        </ModalShell>
      )}

      {/* ---------- ASSIGN MODAL (Unchanged) ---------- */}
      {showAssign && selectedClass && (
        <ModalShell title={`Assign Students — ${selectedClass.class_name}`} onClose={() => setShowAssign(false)}>
          <AssignStudents assignSearch={assignSearch} setAssignSearch={setAssignSearch} filteredStudents={filteredStudents} assignSelected={assignSelected} setAssignSelected={setAssignSelected} />
          <FormActions onCancel={() => setShowAssign(false)} onSubmit={submitAssign} submitText="Assign" />
        </ModalShell>
      )}

      {/* ---------- DELETE MODAL (Unchanged) ---------- */}
      {showDelete && selectedClass && (
        <ModalShell title="Delete Class" onClose={() => setShowDelete(false)}>
          <p className="text-gray-300 mb-4">
            Are you sure you want to delete <b>{selectedClass.class_name}</b>?<br />This will remove all enrolled students.
          </p>
          <FormActions onCancel={() => setShowDelete(false)} onSubmit={submitDelete} submitText="Delete" danger />
        </ModalShell>
      )}
    </div>
  );
}

/* -----------------------------
   CLASS FORM COMPONENT
----------------------------- */
function ClassForm({ form, setForm, lecturers }: any) {
  return (
    <div className="space-y-3">
      <input
        placeholder="Class name"
        className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
        value={form.class_name}
        onChange={(e) => setForm({ ...form, class_name: e.target.value })}
      />

      <input
        placeholder="Course code"
        className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
        value={form.course_code}
        onChange={(e) => setForm({ ...form, course_code: e.target.value })}
      />

      <div>
        <label className="text-sm text-gray-300 block mb-1">Lecturer</label>
        <select
          className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
          value={form.lecturer_id}
          onChange={(e) => setForm({ ...form, lecturer_id: Number(e.target.value) })}
        >
          <option value={0}>-- Select lecturer --</option>
          {lecturers.map((l: any) => (
            <option key={l.lecturer_id} value={l.lecturer_id}>
              {l.name} ({l.email})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm text-gray-300 block mb-1">Day</label>
        <select
          className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
          value={form.day_of_week}
          onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
        >
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <input
          type="time"
          className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
        />

        <input
          type="time"
          className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
        />
      </div>

      <div className="flex gap-3">
        <input
          type="number"
          className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg"
          value={form.start_week}
          min={1}
          max={14}
          onChange={(e) => setForm({ ...form, start_week: Number(e.target.value) })}
        />

        <input
          type="number"
          className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg"
          value={form.end_week}
          min={1}
          max={14}
          onChange={(e) => setForm({ ...form, end_week: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

/* -----------------------------
   ASSIGN STUDENTS COMPONENT
----------------------------- */
function AssignStudents({
  assignSearch,
  setAssignSearch,
  filteredStudents,
  assignSelected,
  setAssignSelected,
}: any) {
  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <input
        placeholder="Search students..."
        value={assignSearch}
        onChange={(e) => setAssignSearch(e.target.value)}
        className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg"
      />

      {filteredStudents.map((s: any) => (
        <label
          key={s.student_id}
          className="flex items-center gap-3 bg-[#111] p-2 rounded-lg border border-white/10"
        >
          <input
            type="checkbox"
            checked={assignSelected.has(s.student_id)}
            onChange={(e) => {
              const next = new Set(assignSelected);
              e.target.checked ? next.add(s.student_id) : next.delete(s.student_id);
              setAssignSelected(next);
            }}
          />
          <div>
            <div className="text-sm font-medium">{s.name}</div>
            <div className="text-xs text-gray-400">
              {s.student_id} — {s.email}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

/* -----------------------------
   MODAL SHELL
----------------------------- */
function ModalShell({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-2xl border border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -----------------------------
   FORM ACTIONS
----------------------------- */
function FormActions({ onCancel, onSubmit, submitText, danger }: any) {
  return (
    <div className="flex justify-end gap-3 mt-4">
      <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-lg">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        className={`px-4 py-2 rounded-lg ${
          danger ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"
        }`}
      >
        {submitText}
      </button>
    </div>
  );
}