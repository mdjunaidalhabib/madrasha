import { useCallback, useEffect, useState } from "react";
import api, { cachedGet } from "../../services/api";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";

export default function ClassPanel() {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [divisionId, setDivisionId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [miyariBookIds, setMiyariBookIds] = useState<number[]>([]);
  const [savingMiyari, setSavingMiyari] = useState(false);

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
      setMiyariBookIds([]);
    }
  }, [divisionId]);

  useEffect(() => {
    if (!divisionId) return;
    loadClasses();
  }, [divisionId, loadClasses]);

  const loadBooks = useCallback(async () => {
    const res = await cachedGet(`/madrasa-books?class_id=${classId}`);
    const data = res.data || [];
    setBooks(data);
    setMiyariBookIds(
      data.filter((book: any) => Boolean(book.is_miyari)).map((book: any) => Number(book.book_id)),
    );
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
      title: "শ্রেণি ডিলিট করুন",
      message: "শ্রেণিটি ডিলিট করতে চান?",
      confirmText: "ডিলিট করুন",
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
      name_bn: name,
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
      title: hasMarks ? "কিতাব ও নম্বর ডিলিট করুন" : "কিতাব ডিলিট করুন",
      message: hasMarks
        ? `“${book.book_name_bn}” কিতাবে ${markCount}টি নম্বর এন্ট্রি আছে। কিতাবটি ডিলিট করলে এর সব নম্বরও স্থায়ীভাবে ডিলিট হবে। আপনি কি নিশ্চিত?`
        : `“${book.book_name_bn}” কিতাবটি ডিলিট করতে চান?`,
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
      name_bn: editingName,
    });

    setEditingId(null);
    loadBooks();
  };

  const startEdit = (book: any) => {
    setEditingId(book.book_id);
    setEditingName(book.book_name_bn);
  };

  const toggleMiyari = (bookId: number) => {
    setMiyariBookIds((current) =>
      current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId],
    );
  };

  const saveMiyariBooks = async () => {
    if (miyariBookIds.length < 1) {
      useToastStore.getState().push("error", "অন্তত ১টি মিয়ারি কিতাব নির্বাচন করুন");
      return;
    }

    setSavingMiyari(true);
    try {
      const res = await api.put("/madrasa-books/miyari", {
        class_id: Number(classId),
        book_ids: miyariBookIds,
      });
      useToastStore.getState().push("success", res.data?.message || "মিয়ারি কিতাব সংরক্ষণ হয়েছে");
      await loadBooks();
    } finally {
      setSavingMiyari(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">মাদরাসা শ্রেণি ও কিতাব ব্যবস্থাপনা</h1>
          <p className="mt-1 text-sm text-slate-500">
            প্রতিটি শ্রেণিতে প্রয়োজন অনুযায়ী এক বা একাধিক মিয়ারি কিতাব নির্ধারণ করুন। চাইলে সব কিতাবই মিয়ারি করা যাবে।
          </p>
        </div>

        <button
          onClick={() => {
            setIsEditMode(!isEditMode);
            setShowClassInput(false);
            setShowBookInput(false);
          }}
          className="rounded bg-gray-800 px-4 py-2 text-white"
        >
          {isEditMode ? "এডিট বন্ধ করুন" : "এডিট করুন"}
        </button>
      </div>

      <div>
        <h2 className="mb-2 font-medium">বিভাগ</h2>
        <div className="flex flex-wrap gap-2">
          {divisions.map((division) => (
            <button
              key={division.division_id}
              onClick={() => setDivisionId(String(division.division_id))}
              className={`rounded border px-3 py-2 ${
                divisionId === String(division.division_id)
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "bg-white"
              }`}
            >
              {division.division_name_bn}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-medium">শ্রেণি</h2>

        <div className="flex flex-wrap gap-2">
          {classes.map((classItem) => (
            <div key={classItem.class_id} className="flex items-center gap-1">
              {editingClassId === classItem.class_id ? (
                <>
                  <input
                    value={editingClassName}
                    onChange={(event) => setEditingClassName(event.target.value)}
                    className="rounded border px-2 py-1"
                  />
                  <button onClick={saveClassEdit}>✔</button>
                </>
              ) : (
                <button
                  onClick={() => setClassId(String(classItem.class_id))}
                  className={`rounded border px-3 py-2 ${
                    classId === String(classItem.class_id)
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "bg-white"
                  }`}
                >
                  {classItem.class_name_bn}
                </button>
              )}

              {isEditMode && (
                <>
                  <button
                    onClick={() => {
                      setEditingClassId(classItem.class_id);
                      setEditingClassName(classItem.class_name_bn);
                    }}
                    aria-label="শ্রেণি এডিট করুন"
                  >
                    ✏️
                  </button>
                  <button onClick={() => removeClass(classItem.class_id)} aria-label="শ্রেণি ডিলিট করুন">
                    🗑️
                  </button>
                </>
              )}
            </div>
          ))}

          {isEditMode &&
            (!showClassInput ? (
              <button onClick={() => setShowClassInput(true)}>➕ শ্রেণি যোগ করুন</button>
            ) : (
              <div className="flex gap-2">
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  className="rounded border px-2 py-1"
                  placeholder="শ্রেণির নাম"
                />
                <button onClick={addClass}>✔</button>
              </div>
            ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">কিতাবসমূহ</h2>
            <p className="mt-1 text-xs text-slate-500">
              মিয়ারি কিতাবে ফেল করলে গড়ে পাস হলেও ফলাফল FAIL হবে। অন্য কিতাবে ফেল করলে গড় পাস থাকলে PASS হবে।
            </p>
          </div>
          <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            নির্বাচিত মিয়ারি: {miyariBookIds.length}টি
          </div>
        </div>

        <div className="space-y-2">
          {books.map((book) => {
            const isMiyari = miyariBookIds.includes(Number(book.book_id));
            return (
              <div
                key={book.book_id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  isMiyari ? "border-amber-300 bg-amber-50" : "bg-white"
                }`}
              >
                {editingId === book.book_id ? (
                  <div className="flex gap-2">
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className="rounded border px-2 py-1"
                    />
                    <button onClick={saveEdit}>✔</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{book.book_name_bn}</span>
                    {isMiyari && (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        মিয়ারি
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {isEditMode && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isMiyari}
                        onChange={() => toggleMiyari(Number(book.book_id))}
                        className="h-4 w-4"
                      />
                      মিয়ারি কিতাব
                    </label>
                  )}

                  {isEditMode && editingId !== book.book_id && (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(book)} aria-label="কিতাব এডিট করুন">
                        ✏️
                      </button>
                      <button onClick={() => removeBook(book)} aria-label="কিতাব ডিলিট করুন">
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {!showBookInput ? (
              <button onClick={() => setShowBookInput(true)}>➕ কিতাব যোগ করুন</button>
            ) : (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded border px-2 py-1"
                  placeholder="কিতাবের নাম"
                />
                <button onClick={addBook}>✔</button>
              </div>
            )}

            <button
              onClick={saveMiyariBooks}
              disabled={savingMiyari || miyariBookIds.length < 1}
              className="rounded bg-amber-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingMiyari ? "সংরক্ষণ হচ্ছে..." : "মিয়ারি সেটিং সংরক্ষণ করুন"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
