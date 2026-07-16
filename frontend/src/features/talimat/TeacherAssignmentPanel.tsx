import { useEffect, useState } from "react";
import api from "../../services/api";

import DivisionTabs from "../../components/ClassPanel/DivisionTabs";
import BookList from "../../components/ClassPanel/BookList";

export default function TeacherAssignmentPanel() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🔥 EDIT TRACK KEY (IMPORTANT FIX)
  const [editKey, setEditKey] = useState<{
    teacher_id: number;
    class_id: number;
  } | null>(null);

  const [form, setForm] = useState({
    teacherId: "",
    divisionId: "",
    classId: "",
    selectedBooksByClass: {} as Record<number, number[]>,
  });

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* ================= LOAD ================= */
  useEffect(() => {
    const load = async () => {
      const [t, d, a] = await Promise.all([
        api.get("/teachers"),
        api.get("/madrasa-divisions"),
        api.get("/teacher-assignments/all"),
      ]);

      setTeachers(t.data?.data || []);
      setDivisions(d.data || []);
      setAssignments(a.data?.data || a.data || []);
    };

    load();
  }, []);

  /* ================= CLASSES ================= */
  useEffect(() => {
    if (!form.divisionId) {
      setClasses([]);
      return;
    }

    api
      .get(`/madrasa-classes?division_id=${form.divisionId}`)
      .then((res) => setClasses(res.data || []));
  }, [form.divisionId]);

  /* ================= BOOKS ================= */
  useEffect(() => {
    if (!form.classId) {
      setBooks([]);
      return;
    }

    api
      .get(`/madrasa-books?class_id=${Number(form.classId)}`)
      .then((res) => setBooks(res.data || []));
  }, [form.classId]);

  /* ================= ASSIGNED ================= */
  const assignedBookIds = new Set(
    assignments.flatMap((a: any) => a.books.map((b: any) => b.book_id)),
  );

  /* ================= BOOK STATE ================= */
  const currentClassId = Number(form.classId);

  const currentSelected = form.selectedBooksByClass[currentClassId] || [];

  const setCurrentSelected = (ids: number[]) => {
    setForm((prev) => ({
      ...prev,
      selectedBooksByClass: {
        ...prev.selectedBooksByClass,
        [currentClassId]: ids,
      },
    }));
  };

  const availableBooks = books.filter((b: any) => {
    const id = Number(b.id || b.book_id);
    return !assignedBookIds.has(id) || currentSelected.includes(id);
  });

  /* ================= TEACHERS ================= */
  const assignedTeacherIds = new Set(assignments.map((a: any) => a.teacher_id));

  const availableTeachers = teachers.filter((t) => {
    if (isEdit && Number(form.teacherId) === t.id) return true;
    return !assignedTeacherIds.has(t.id);
  });

  const selectedTeacher = teachers.find((t) => t.id === Number(form.teacherId));

  /* ================= OPEN CREATE ================= */
  const openCreate = () => {
    setIsEdit(false);
    setEditKey(null);

    setForm({
      teacherId: "",
      divisionId: "",
      classId: "",
      selectedBooksByClass: {},
    });

    setModalOpen(true);
  };

  /* ================= OPEN EDIT ================= */
  const openEdit = (a: any) => {
    setIsEdit(true);

    setEditKey({
      teacher_id: a.teacher_id,
      class_id: a.class_id,
    });

    const map: Record<number, number[]> = {};
    map[a.class_id] = a.books.map((b: any) => b.book_id);

    setForm({
      teacherId: a.teacher_id,
      divisionId: a.division_id,
      classId: a.class_id,
      selectedBooksByClass: map,
    });

    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  /* ================= SAVE (FIXED EDIT BUG) ================= */
  const save = async () => {
    setSaving(true);

    try {
      const book_ids = Object.values(form.selectedBooksByClass).flat();

      const payload = {
        teacher_id: Number(form.teacherId),
        class_id: Number(form.classId),
        book_ids,
      };

      // 🔥 IMPORTANT FIX FOR EDIT
      if (isEdit && editKey) {
        await api.post("/teacher-assignments/delete", {
          teacher_id: editKey.teacher_id,
          class_id: editKey.class_id,
        });

        await api.post("/teacher-assignments", payload);
      } else {
        await api.post("/teacher-assignments", payload);
      }

      const res = await api.get("/teacher-assignments/all");
      setAssignments(res.data?.data || res.data || []);

      setModalOpen(false);
      setEditKey(null);
    } finally {
      setSaving(false);
    }
  };

  /* ================= DELETE ================= */
  const deleteAssignment = async (a: any) => {
    await api.post("/teacher-assignments/delete", {
      teacher_id: a.teacher_id,
      class_id: a.class_id,
    });

    const res = await api.get("/teacher-assignments/all");
    setAssignments(res.data?.data || res.data || []);
  };

  /* ================= UI ================= */
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto bg-gray-100 min-h-screen">
      {/* LEFT LIST */}

      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold">Teacher Assignments</h1>

          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto">
            + New
          </button>
        </div>

        {/* GRID VIEW */}
        {assignments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assignments.map((a: any, i: number) => (
              <div key={i} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between">
                  <h2 className="font-bold">{a.teacher_name}</h2>

                  <div className="flex gap-2">
                    <button onClick={() => openEdit(a)} className="text-blue-600">
                      Edit
                    </button>

                    <button onClick={() => deleteAssignment(a)} className="text-red-600">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {a.books?.map((b: any, j: number) => (
                    <div key={j} className="bg-gray-100 px-2 py-1 rounded">
                      📘 {b.book_name_bn}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No assignments found</div>
        )}
      </div>

      {/* ================= MODAL ================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto bg-white rounded-lg p-4 sm:p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={closeModal} className="absolute right-3 top-2 text-xl">
              ✖
            </button>

            <h2 className="text-lg font-bold mb-4">{isEdit ? "Edit" : "Create"} Assignment</h2>

            {/* TEACHER */}
            {isEdit ? (
              <div className="mb-3 p-2 bg-gray-100 rounded">
                Teacher: <b>{selectedTeacher?.name_bn}</b>
              </div>
            ) : (
              <select
                value={form.teacherId}
                onChange={(e) => updateForm("teacherId", e.target.value)}
                className="w-full border p-2 mb-3"
              >
                <option value="">Select Teacher</option>

                {availableTeachers.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name_bn}
                  </option>
                ))}
              </select>
            )}

            {/* DIVISION */}
            <DivisionTabs
              divisions={divisions}
              divisionId={form.divisionId}
              setDivisionId={(v: any) => updateForm("divisionId", v)}
            />

            {/* CLASS */}
            <div className="mt-3">
              <h2 className="mb-2 font-medium">Class</h2>

              <div className="flex gap-2 flex-wrap">
                {classes.map((c: any) => (
                  <button
                    key={c.class_id}
                    onClick={() => updateForm("classId", c.class_id)}
                    className={`px-3 py-2 border rounded ${
                      form.classId === c.class_id ? "bg-green-500 text-white" : ""
                    }`}
                  >
                    {c.class_name_bn}
                  </button>
                ))}
              </div>
            </div>

            {/* BOOK LIST */}
            <BookList
              books={availableBooks}
              selectedBooks={currentSelected}
              setSelectedBooks={setCurrentSelected}
            />

            {/* SAVE */}
            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 mt-5 rounded"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
