import { useCallback, useEffect, useState } from "react";
import api, { cachedGet } from "../../services/api";
import { useConfirmStore } from "../../store/confirmStore";

export default function ClassPanel() {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [divisionId, setDivisionId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");

  const [isEditMode, setIsEditMode] = useState(false);

  // CLASS
  const [className, setClassName] = useState("");
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingClassName, setEditingClassName] = useState("");
  const [showClassInput, setShowClassInput] = useState(false);

  // BOOK
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showBookInput, setShowBookInput] = useState(false);

  /* ================= LOAD ================= */

  const loadDivisions = useCallback(async () => {
    const res = await cachedGet("/madrasa-divisions");
    const data = res.data || [];

    setDivisions(data);
    if (data.length) setDivisionId(String(data[0].division_id));
  }, []);

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  const loadClasses = useCallback(async () => {
    const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
    const data = res.data || [];

    setClasses(data);

    if (data.length) setClassId(String(data[0].class_id));
    else {
      setClassId("");
      setBooks([]);
    }
  }, [divisionId]);

  useEffect(() => {
    if (!divisionId) return;
    loadClasses();
  }, [divisionId, loadClasses]);

  const loadBooks = useCallback(async () => {
    const res = await cachedGet(`/madrasa-books?class_id=${classId}`);
    setBooks(res.data || []);
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    loadBooks();
  }, [classId, loadBooks]);

  /* ================= CLASS ================= */

  const addClass = async () => {
    if (!className.trim()) return;

    await api.post("/madrasa-classes", {
      division_id: divisionId,
      name_bn: className,
    });

    setClassName("");
    loadClasses();
  };

  const removeClass = (id: number) => {
    useConfirmStore.getState().show({
      title: "Delete Class",
      message: "Delete class?",
      confirmText: "Delete",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/madrasa-classes/${id}`);
        loadClasses();
      },
    });
  };

  const saveClassEdit = async () => {
    if (!editingClassName.trim()) return;

    await api.put(`/madrasa-classes/${editingClassId}`, {
      name_bn: editingClassName,
    });

    setEditingClassId(null);
    loadClasses();
  };

  /* ================= BOOK ================= */

  const addBook = async () => {
    if (!name.trim()) return;

    await api.post("/madrasa-books", {
      class_id: classId,
      name_bn: name, // ✅ বাংলা field
    });

    setName("");
    loadBooks();
  };

  const removeBook = async (book: any) => {
    const response = await api.get(`/madrasa-books/${book.book_id}/delete-info`);
    const deleteInfo = response.data || {};
    const hasMarks = Boolean(deleteInfo.has_marks);
    const markCount = Number(deleteInfo.mark_count || 0);

    useConfirmStore.getState().show({
      title: hasMarks ? "সাবজেক্ট ও নম্বর ডিলিট করুন" : "সাবজেক্ট ডিলিট করুন",
      message: hasMarks
        ? `“${book.book_name_bn}” সাবজেক্টে ${markCount}টি নম্বর এন্ট্রি আছে। সাবজেক্টটি ডিলিট করলে এর সব নম্বরও স্থায়ীভাবে ডিলিট হয়ে যাবে। আপনি কি নিশ্চিত?`
        : `“${book.book_name_bn}” সাবজেক্টটি ডিলিট করতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        const confirmQuery = hasMarks ? "?confirm_marks=true" : "";
        await api.delete(`/madrasa-books/${book.book_id}${confirmQuery}`);
        await loadBooks();
      },
    });
  };

  const saveEdit = async () => {
    if (!editingName.trim()) return;

    await api.put(`/madrasa-books/${editingId}`, {
      name_bn: editingName, // ✅ বাংলা update
    });

    setEditingId(null);
    loadBooks();
  };

  const startEdit = (b: any) => {
    setEditingId(b.book_id);
    setEditingName(b.book_name_bn); // ✅ বাংলা value
  };

  /* ================= UI ================= */

  return (
    <div className="p-6 space-y-6">
      {/* TOP BAR */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Madrasa Manage Panel</h1>

        <button
          onClick={() => {
            setIsEditMode(!isEditMode);
            setShowClassInput(false);
            setShowBookInput(false);
          }}
          className="bg-gray-800 text-white px-4 py-2 rounded"
        >
          {isEditMode ? "Exit Edit" : "Edit"}
        </button>
      </div>

      {/* DIVISION */}
      <div>
        <h2 className="mb-2 font-medium">Divisions</h2>
        <div className="flex gap-2 flex-wrap">
          {divisions.map((d) => (
            <button
              key={d.division_id}
              onClick={() => setDivisionId(String(d.division_id))}
              className={`px-3 py-2 border rounded ${
                divisionId === String(d.division_id) ? "bg-blue-500 text-white" : "bg-white"
              }`}
            >
              {d.division_name_bn}
            </button>
          ))}
        </div>
      </div>

      {/* CLASS */}
      <div>
        <h2 className="mb-2 font-medium">Classes</h2>

        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <div key={c.class_id} className="flex items-center gap-1">
              {editingClassId === c.class_id ? (
                <>
                  <input
                    value={editingClassName}
                    onChange={(e) => setEditingClassName(e.target.value)}
                    className="border px-2 py-1"
                  />
                  <button onClick={saveClassEdit}>✔</button>
                </>
              ) : (
                <button
                  onClick={() => setClassId(String(c.class_id))}
                  className={`px-3 py-2 border rounded ${
                    classId === String(c.class_id) ? "bg-green-500 text-white" : "bg-white"
                  }`}
                >
                  {c.class_name_bn}
                </button>
              )}

              {isEditMode && (
                <>
                  <button
                    onClick={() => {
                      setEditingClassId(c.class_id);
                      setEditingClassName(c.class_name_bn);
                    }}
                  >
                    ✏️
                  </button>
                  <button onClick={() => removeClass(c.class_id)}>🗑️</button>
                </>
              )}
            </div>
          ))}

          {isEditMode && (
            <>
              {!showClassInput ? (
                <button onClick={() => setShowClassInput(true)}>➕</button>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="border px-2 py-1"
                  />
                  <button onClick={addClass}>✔</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* BOOK */}
      <div>
        <h2 className="mb-2 font-medium">Books</h2>

        {books.map((b) => (
          <div key={b.book_id} className="flex justify-between border px-3 py-2 rounded">
            {editingId === b.book_id ? (
              <div className="flex gap-2">
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="border px-2 py-1"
                />
                <button onClick={saveEdit}>✔</button>
              </div>
            ) : (
              <>
                {/* ✅ বাংলা নাম */}
                <span>{b.book_name_bn}</span>

                {isEditMode && (
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(b)}>✏️</button>
                    <button onClick={() => removeBook(b)}>🗑️</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {isEditMode && (
          <div className="mt-3">
            {!showBookInput ? (
              <button onClick={() => setShowBookInput(true)}>➕ Add Book</button>
            ) : (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border px-2 py-1"
                />
                <button onClick={addBook}>✔</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
