import { useEffect, useMemo, useState } from "react";
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
  enrolled_count: number;

  // frontend default (backend does not send student list)
  students_enrolled: Student[];
}

const ROWS_PER_PAGE = 25;

/* -----------------------------
   MAIN COMPONENT
----------------------------- */
export default function AdminClasses() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
     Load Data from Backend
  ----------------------------- */
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [cRes, lRes, sRes] = await Promise.all([
          adminApi.get("/admin/classes"),
          adminApi.get("/admin/lecturers"),
          adminApi.get("/admin/students"),
        ]);

        const classList = cRes.data?.data?.classes || [];
        const lecturerList = lRes.data?.data?.lecturers || [];
        const studentList = sRes.data?.data?.students || [];

        setClasses(
          classList.map((c: any) => ({
            ...c,
            lecturer_name: c.lecturer_name ?? "",
            students_enrolled: [], // backend does not return list → safe default
          }))
        );

        setLecturers(lecturerList);
        setStudents(
          studentList.map((s: any) => ({
            student_id: Number(s.student_id),
            name: s.name,
            email: s.email,
          }))
        );
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  /* -----------------------------
     Filtering + Pagination
  ----------------------------- */
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return classes;

    return classes.filter((c) =>
      [
        c.class_name.toLowerCase(),
        c.course_code.toLowerCase(),
        (c.lecturer_name || "").toLowerCase(),
      ].some((field) => field.includes(q))
    );
  }, [classes, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageStart = (currentPage - 1) * ROWS_PER_PAGE;
  const pageClasses = filtered.slice(pageStart, pageStart + ROWS_PER_PAGE);

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

      const created = {
        ...res.data.data,
        lecturer_name:
          lecturers.find((l) => l.lecturer_id === payload.lecturer_id)?.name ?? "",
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
                lecturer_name:
                  lecturers.find((l) => l.lecturer_id === payload.lecturer_id)?.name ?? "",
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin — Classes</h1>

        <div className="flex items-center gap-3">
          <input
            placeholder="Search classes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 rounded-lg bg-[#101010] border border-white/10 w-[300px]"
          />

          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            <Plus size={16} />
            Create Class
          </button>
        </div>
      </div>

      {/* Table */}
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
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : pageClasses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  No classes found.
                </td>
              </tr>
            ) : (
              pageClasses.map((cls) => {
                const isExpanded = expandedRows.has(cls.class_id);

                return (
                  <tbody key={cls.class_id}>
                    <tr className="border-t border-white/5 hover:bg-[#222233]">
                      <td className="p-4">{cls.class_name}</td>
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

                      <td className="p-4">
                        Week {cls.start_week}–{cls.end_week}
                      </td>

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
      <div className="flex justify-center items-center gap-4 mb-6">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="p-2 disabled:opacity-30"
        >
          <ChevronLeft />
        </button>

        <p>
          Page <span className="font-semibold">{currentPage}</span> of {totalPages}
        </p>

        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          className="p-2 disabled:opacity-30"
        >
          <ChevronRight />
        </button>
      </div>

      {/* ---------- CREATE MODAL ---------- */}
      {showCreate && (
        <ModalShell title="Create Class" onClose={() => setShowCreate(false)}>
          <ClassForm form={form} setForm={setForm} lecturers={lecturers} />
          <FormActions
            onCancel={() => setShowCreate(false)}
            onSubmit={submitCreate}
            submitText="Create"
          />
        </ModalShell>
      )}

      {/* ---------- EDIT MODAL ---------- */}
      {showEdit && selectedClass && (
        <ModalShell title="Edit Class" onClose={() => setShowEdit(false)}>
          <ClassForm form={form} setForm={setForm} lecturers={lecturers} />
          <FormActions
            onCancel={() => setShowEdit(false)}
            onSubmit={submitEdit}
            submitText="Save"
          />
        </ModalShell>
      )}

      {/* ---------- ASSIGN MODAL ---------- */}
      {showAssign && selectedClass && (
        <ModalShell title={`Assign Students — ${selectedClass.class_name}`} onClose={() => setShowAssign(false)}>
          <AssignStudents
            assignSearch={assignSearch}
            setAssignSearch={setAssignSearch}
            filteredStudents={filteredStudents}
            assignSelected={assignSelected}
            setAssignSelected={setAssignSelected}
          />
          <FormActions
            onCancel={() => setShowAssign(false)}
            onSubmit={submitAssign}
            submitText="Assign"
          />
        </ModalShell>
      )}

      {/* ---------- DELETE MODAL ---------- */}
      {showDelete && selectedClass && (
        <ModalShell title="Delete Class" onClose={() => setShowDelete(false)}>
          <p className="text-gray-300 mb-4">
            Are you sure you want to delete <b>{selectedClass.class_name}</b>?
            <br />
            This will remove all enrolled students.
          </p>
          <FormActions
            onCancel={() => setShowDelete(false)}
            onSubmit={submitDelete}
            submitText="Delete"
            danger
          />
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