// src/pages/admin/AdminClasses.tsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Edit,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

export interface ClassItem {
  class_id: number;
  class_name: string;
  course_code: string;
  lecturer_id: number;
  lecturer_name?: string;
  lecturer_email?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  start_week: number;
  end_week: number;
  class_type?: "Lecture" | "Tutorial";
  students_enrolled: Student[];
}

const ROWS_PER_PAGE = 25;

export default function AdminClasses() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Table UI state
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Modals / forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Form state (create / edit)
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

  // Assign modal state
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState<Set<number>>(new Set());

  // ------------------ Load data ------------------
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        // TODO: adjust endpoints if different on backend
        const [classesRes, lecturersRes, studentsRes] = await Promise.all([
          axios.get<ClassItem[]>("/admin/classes").catch(() => ({ data: null })),
          axios.get<Lecturer[]>("/admin/lecturers").catch(() => ({ data: null })),
          axios.get<Student[]>("/admin/students").catch(() => ({ data: null })),
        ]);

        if (classesRes?.data) setClasses(classesRes.data);
        if (lecturersRes?.data) setLecturers(lecturersRes.data);
        if (studentsRes?.data) setStudents(studentsRes.data);

        // If backend not ready, fall back to small mock dataset so UI is usable
        if (!classesRes?.data && !lecturersRes?.data && !studentsRes?.data) {
          const mockLecturers: Lecturer[] = [
            { lecturer_id: 1, name: "Dr. Adam", email: "adam@uni.edu" },
            { lecturer_id: 2, name: "Prof. Lina", email: "lina@uni.edu" },
          ];
          const mockStudents: Student[] = [
            { student_id: 1001, name: "John Doe", email: "john@uni.edu" },
            { student_id: 1002, name: "Sara Tan", email: "sara@uni.edu" },
            { student_id: 1003, name: "Mike Lee", email: "mike@uni.edu" },
          ];
          const mockClasses: ClassItem[] = [
            {
              class_id: 1,
              class_name: "Software Engineering",
              course_code: "CS305",
              lecturer_id: 1,
              lecturer_name: "Dr. Adam",
              lecturer_email: "adam@uni.edu",
              day_of_week: "Monday",
              start_time: "09:00",
              end_time: "11:00",
              start_week: 1,
              end_week: 14,
              class_type: "Lecture",
              students_enrolled: [mockStudents[0]!, mockStudents[1]!],
            },
            {
              class_id: 2,
              class_name: "Database Systems",
              course_code: "CS310",
              lecturer_id: 2,
              lecturer_name: "Prof. Lina",
              lecturer_email: "lina@uni.edu",
              day_of_week: "Wednesday",
              start_time: "13:00",
              end_time: "15:00",
              start_week: 1,
              end_week: 7,
              class_type: "Lecture",
              students_enrolled: [mockStudents[2]!],
            },
          ];

          setLecturers(mockLecturers);
          setStudents(mockStudents);
          setClasses(mockClasses);
        }
      } catch (err) {
        console.error("Load error", err);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  // ------------------ Filtering & pagination ------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) =>
        c.class_name.toLowerCase().includes(q) ||
        c.course_code.toLowerCase().includes(q) ||
        (c.lecturer_name || "").toLowerCase().includes(q) ||
        (c.lecturer_email || "").toLowerCase().includes(q)
    );
  }, [classes, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  // ------------------ Create / Edit / Delete / Assign ------------------
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
    setShowCreateModal(true);
  };

  const openEdit = (cls: ClassItem) => {
    setSelectedClass(cls);
    setForm({
      class_name: cls.class_name,
      course_code: cls.course_code,
      lecturer_id: cls.lecturer_id,
      day_of_week: cls.day_of_week,
      start_time: cls.start_time,
      end_time: cls.end_time,
      start_week: cls.start_week,
      end_week: cls.end_week,
      class_type: cls.class_type || "Lecture",
    });
    setShowEditModal(true);
  };

  const submitCreate = async () => {
    // Basic validation
    if (!form.class_name || !form.course_code) return alert("Enter class name & course code");

    try {
      // TODO: backend endpoint: POST /admin/classes
      const payload = { ...form, lecturer_id: Number(form.lecturer_id) };
      const res = await axios.post("/admin/classes", payload).catch(() => null);

      if (res?.data) {
        // backend returned created class
        setClasses((prev) => [res.data, ...prev]);
      } else {
        // Fallback: mock-add with temp id
        setClasses((prev) => [
            {
                class_id: Math.max(0, ...prev.map((p) => p.class_id)) + 1,

                // Spread form first (this includes class_name, course_code, class_type, etc.)
                ...form,

                // Override class_type explicitly (ONE source of truth)
                class_type: form.class_type as "Lecture" | "Tutorial",

                lecturer_name:
                lecturers.find((l) => l.lecturer_id === form.lecturer_id)?.name ?? "",
                lecturer_email:
                lecturers.find((l) => l.lecturer_id === form.lecturer_id)?.email ?? "",

                // Always last so nothing overrides it
                students_enrolled: [],
            } as ClassItem,
            ...prev,
        ]);
      }
      setShowCreateModal(false);
    } catch (err) {
      console.error("Create error", err);
      alert("Failed to create class");
    }
  };

  const submitEdit = async () => {
    if (!selectedClass) return;
    try {
      const payload = { ...form, lecturer_id: Number(form.lecturer_id) };
      // TODO: backend endpoint: PUT /admin/classes/:id
      const res = await axios.put(`/admin/classes/${selectedClass.class_id}`, payload).catch(() => null);

      if (res?.data) {
        setClasses((prev) => prev.map((c) => (c.class_id === selectedClass.class_id ? res.data : c)));
      } else {
        setClasses((prev) =>
            prev.map((c) =>
                c.class_id === selectedClass.class_id
                ? ({
                    ...c,
                    ...payload,
                    class_type: payload.class_type as "Lecture" | "Tutorial",
                    lecturer_name:
                        lecturers.find((l) => l.lecturer_id === payload.lecturer_id)?.name ?? "",
                    lecturer_email:
                        lecturers.find((l) => l.lecturer_id === payload.lecturer_id)?.email ?? "",
                    } as ClassItem)
                : c
            )
        );
      }
      setShowEditModal(false);
    } catch (err) {
      console.error("Edit error", err);
      alert("Failed to update class");
    }
  };

  const openAssign = (cls: ClassItem) => {
    setSelectedClass(cls);
    setAssignSelected(new Set());
    setAssignSearch("");
    setShowAssignModal(true);
  };

  const submitAssign = async () => {
    if (!selectedClass) return;
    const ids = Array.from(assignSelected);

    try {
      // TODO: backend endpoint: POST /admin/classes/:id/students with { student_ids: [...] }
      const res = await axios.post(`/admin/classes/${selectedClass.class_id}/students`, { student_ids: ids }).catch(() => null);

      if (res?.data) {
        // expect res.data.updatedStudents or similar
        setClasses((prev) =>
          prev.map((c) =>
            c.class_id === selectedClass.class_id ? { ...c, students_enrolled: res.data } : c
          )
        );
      } else {
        // Fallback: add selected students locally
        const newStudents = students.filter((s) => assignSelected.has(s.student_id));
        setClasses((prev) =>
          prev.map((c) =>
            c.class_id === selectedClass.class_id
              ? {
                  ...c,
                  students_enrolled: [
                    ...c.students_enrolled,
                    ...newStudents.filter((ns) => !c.students_enrolled.some((e) => e.student_id === ns.student_id)),
                  ],
                }
              : c
          )
        );
      }

      setShowAssignModal(false);
    } catch (err) {
      console.error("Assign error", err);
      alert("Failed to assign students");
    }
  };

  const openDelete = (cls: ClassItem) => {
    setSelectedClass(cls);
    setShowDeleteModal(true);
  };

  const submitDelete = async () => {
    if (!selectedClass) return;
    try {
      // TODO: backend endpoint: DELETE /admin/classes/:id
      await axios.delete(`/admin/classes/${selectedClass.class_id}`).catch(() => null);
      setClasses((prev) => prev.filter((c) => c.class_id !== selectedClass.class_id));
      setShowDeleteModal(false);
    } catch (err) {
      console.error("Delete error", err);
      alert("Failed to delete class");
    }
  };

  // ------------------ Assign modal filtered students ------------------
  const filteredStudents = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        String(s.student_id).includes(q)
    );
  }, [students, assignSearch]);

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin — Classes</h1>

        <div className="flex items-center gap-3">
          <input
            placeholder="Search classes, lecturer..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-[#101010] border border-white/10 w-[320px]"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            <Plus size={16} /> Create Class
          </button>
        </div>
      </div>

      <div className="bg-[#181818]/70 rounded-xl border border-white/10 overflow-hidden mb-6">
        <table className="w-full text-left">
          <thead className="bg-[#1f1f2f] text-gray-300">
            <tr>
              <th className="p-4">Class Name</th>
              <th className="p-4">Course Code</th>
              <th className="p-4">Lecturer</th>
              <th className="p-4">Day & Time</th>
              <th className="p-4">Weeks</th>
              <th className="p-4">Students</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-300">
                  Loading...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  No classes found.
                </td>
              </tr>
            ) : (
              pageItems.map((cls) => {
                const isExpanded = expandedRows.has(cls.class_id);

                return (
                  <tbody key={cls.class_id}>
                    <tr className="border-t border-white/5 hover:bg-[#222233]">
                      <td className="p-4">{cls.class_name}</td>
                      <td className="p-4">{cls.course_code}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span>{cls.lecturer_name}</span>
                          <span className="text-sm text-gray-400">{cls.lecturer_email}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {cls.day_of_week} <br />
                        <span className="text-gray-400 text-sm">
                          {cls.start_time}–{cls.end_time}
                        </span>
                      </td>
                      <td className="p-4">Week {cls.start_week}–{cls.end_week}</td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleRow(cls.class_id)}
                          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span>{cls.students_enrolled.length} students</span>
                        </button>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-3">
                        <button onClick={() => openEdit(cls)} className="text-yellow-400 hover:text-yellow-300">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => openAssign(cls)} className="text-blue-400 hover:text-blue-300">
                          <Users size={16} />
                        </button>
                        <button onClick={() => openDelete(cls)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#15151b] border-t border-white/5">
                        <td colSpan={7} className="p-4">
                          {cls.students_enrolled.length === 0 ? (
                            <div className="text-gray-400 italic">No students enrolled.</div>
                          ) : (
                            <ul className="space-y-1">
                              {cls.students_enrolled.map((s) => (
                                <li key={s.student_id} className="text-gray-200">
                                  • {s.name} ({s.student_id})
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="p-2 disabled:opacity-30">
          <ChevronLeft />
        </button>

        <p>
          Page <span className="font-semibold">{currentPage}</span> of {totalPages}
        </p>

        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="p-2 disabled:opacity-30">
          <ChevronRight />
        </button>
      </div>

      {/* ----------------- CREATE MODAL ----------------- */}
      {showCreateModal && (
        <ModalShell title="Create Class" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-3">
            <input className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" placeholder="Class name" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />
            <input className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" placeholder="Course code" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} />

            <div>
              <label className="text-sm text-gray-300 block mb-1">Lecturer</label>
              <select className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.lecturer_id} onChange={(e) => setForm({ ...form, lecturer_id: Number(e.target.value) })}>
                <option value={0}>-- Select lecturer --</option>
                {lecturers.map((l) => (
                  <option key={l.lecturer_id} value={l.lecturer_id}>
                    {l.name} ({l.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-300 block mb-1">Day</label>
              <select className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <input type="time" className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <input type="time" className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>

            <div className="flex gap-3">
              <input type="number" min={1} max={14} className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.start_week} onChange={(e) => setForm({ ...form, start_week: Number(e.target.value) })} />
              <input type="number" min={1} max={14} className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.end_week} onChange={(e) => setForm({ ...form, end_week: Number(e.target.value) })} />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-gray-600 rounded-lg">Cancel</button>
              <button onClick={submitCreate} className="px-4 py-2 bg-green-600 rounded-lg">Create</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ----------------- EDIT MODAL ----------------- */}
      {showEditModal && selectedClass && (
        <ModalShell title="Edit Class" onClose={() => setShowEditModal(false)}>
          <div className="space-y-3">
            <input className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" placeholder="Class name" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />
            <input className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" placeholder="Course code" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} />

            <div>
              <label className="text-sm text-gray-300 block mb-1">Lecturer</label>
              <select className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.lecturer_id} onChange={(e) => setForm({ ...form, lecturer_id: Number(e.target.value) })}>
                {lecturers.map((l) => (
                  <option key={l.lecturer_id} value={l.lecturer_id}>
                    {l.name} ({l.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-300 block mb-1">Day</label>
              <select className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <input type="time" className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <input type="time" className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>

            <div className="flex gap-3">
              <input type="number" min={1} max={14} className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.start_week} onChange={(e) => setForm({ ...form, start_week: Number(e.target.value) })} />
              <input type="number" min={1} max={14} className="flex-1 p-3 bg-[#101010] border border-white/10 rounded-lg" value={form.end_week} onChange={(e) => setForm({ ...form, end_week: Number(e.target.value) })} />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-600 rounded-lg">Cancel</button>
              <button onClick={submitEdit} className="px-4 py-2 bg-blue-600 rounded-lg">Save</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ----------------- ASSIGN STUDENTS MODAL ----------------- */}
      {showAssignModal && selectedClass && (
        <ModalShell title={`Assign Students — ${selectedClass.class_name}`} onClose={() => setShowAssignModal(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <input placeholder="Search students (id, name, email)" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} className="w-full p-3 bg-[#101010] border border-white/10 rounded-lg" />

            <div className="space-y-2 mt-2">
              {filteredStudents.map((s) => (
                <label key={s.student_id} className="flex items-center gap-3 bg-[#111] p-2 rounded-lg border border-white/10">
                  <input type="checkbox" checked={assignSelected.has(s.student_id)} onChange={(e) => {
                    const copy = new Set(assignSelected);
                    if (e.target.checked) copy.add(s.student_id);
                    else copy.delete(s.student_id);
                    setAssignSelected(copy);
                  }} />
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.student_id} — {s.email}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 bg-gray-600 rounded-lg">Cancel</button>
              <button onClick={submitAssign} className="px-4 py-2 bg-green-600 rounded-lg">Assign Selected</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ----------------- DELETE CONFIRM ----------------- */}
      {showDeleteModal && selectedClass && (
        <ModalShell title="Delete Class" onClose={() => setShowDeleteModal(false)}>
          <p className="text-gray-300 mb-4">
            This will delete the class and unassign all students. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-600 rounded-lg">Cancel</button>
            <button onClick={submitDelete} className="px-4 py-2 bg-red-600 rounded-lg">Delete</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ---------- ModalShell component ---------- */
function ModalShell({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#181818] p-6 rounded-xl w-full max-w-2xl border border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}