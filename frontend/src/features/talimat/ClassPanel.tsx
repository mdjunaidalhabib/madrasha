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
  const [editingClassOriginalName, setEditingClassOriginalName] = useState("");
  const [showClassInput, setShowClassInput] = useState(false);

  // BOOK
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingOriginalName, setEditingOriginalName] = useState("");
  const [showBookInput, setShowBookInput] = useState(false);
  const [dragBookId, setDragBookId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

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
    const trimmed = editingClassName.trim();
    if (!trimmed || trimmed === editingClassOriginalName.trim()) {
      setEditingClassId(null);
      return;
    }

    const id = editingClassId;
    setEditingClassId(null);
    await api.put(`/madrasa-classes/${id}`, {
      name_bn: trimmed,
    });

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
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === editingOriginalName.trim()) {
      setEditingId(null);
      return;
    }

    const id = editingId;
    setEditingId(null);
    await api.put(`/madrasa-books/${id}`, {
      name_bn: trimmed,
    });

    loadBooks();
  };

  const startEdit = (book: any) => {
    setEditingId(book.book_id);
    setEditingName(book.book_name_bn);
    setEditingOriginalName(book.book_name_bn);
  };

  /* ================= BOOK ORDER (drag & drop) ================= */

  const reorderBooksLocally = (targetBookId: number) => {
    if (dragBookId === null || dragBookId === targetBookId) return;

    setBooks((prev) => {
      const from = prev.findIndex((b: any) => b.book_id === dragBookId);
      const to = prev.findIndex((b: any) => b.book_id === targetBookId);
      if (from === -1 || to === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const persistBookOrder = async (orderedBooks: any[]) => {
    setSavingOrder(true);
    try {
      await api.put("/madrasa-books/reorder", {
        class_id: Number(classId),
        book_ids: orderedBooks.map((b) => b.book_id),
      });
    } catch (err: any) {
      useToastStore.getState().push("error", err?.response?.data?.message || "ক্রম সংরক্ষণ করা যায়নি");
      loadBooks();
    } finally {
      setSavingOrder(false);
    }
  };

  // Pointer Events (not HTML5 drag-and-drop) so the same handlers work for
  // mouse, touch and pen. elementFromPoint uses viewport hit-testing, so it
  // keeps finding the card under the finger/cursor even while this handle
  // holds pointer capture.
  const handleHandlePointerDown = (bookId: number) => (event: React.PointerEvent) => {
    if (!isEditMode || savingOrder) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDragBookId(bookId);
  };

  const handleHandlePointerMove = (event: React.PointerEvent) => {
    if (dragBookId === null) return;
    const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const card = hovered?.closest<HTMLElement>("[data-book-id]");
    const targetBookId = Number(card?.dataset.bookId);
    if (!targetBookId) return;
    reorderBooksLocally(targetBookId);
  };

  const handleHandlePointerEnd = () => {
    if (dragBookId === null) return;
    setDragBookId(null);
    persistBookOrder(books);
  };

  // Checking/unchecking a book saves immediately - no separate "Save" step,
  // and zero miyari books is a valid state (a class doesn't have to have one).
  const toggleMiyari = async (bookId: number) => {
    const previous = miyariBookIds;
    const next = previous.includes(bookId)
      ? previous.filter((id) => id !== bookId)
      : [...previous, bookId];

    setMiyariBookIds(next);
    setSavingMiyari(true);
    try {
      const res = await api.put("/madrasa-books/miyari", {
        class_id: Number(classId),
        book_ids: next,
      });
      useToastStore.getState().push("success", res.data?.message || "মিয়ারি কিতাব সংরক্ষণ হয়েছে");
    } catch (err: any) {
      setMiyariBookIds(previous);
      useToastStore.getState().push("error", err?.response?.data?.message || "সংরক্ষণ করা যায়নি");
    } finally {
      setSavingMiyari(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">মাদরাসা শ্রেণি ও কিতাব ব্যবস্থাপনা</h1>
          <p className="mt-1 text-sm text-slate-500">
            প্রতিটি শ্রেণিতে প্রয়োজন অনুযায়ী এক বা একাধিক মিয়ারি কিতাব নির্ধারণ করুন। চেক/আনচেক করলেই সাথে সাথে সংরক্ষণ হয়ে যাবে — কোনো কিতাবই মিয়ারি না রাখলেও চলবে।
          </p>
        </div>

        <button
          onClick={() => {
            setIsEditMode(!isEditMode);
            setShowClassInput(false);
            setShowBookInput(false);
          }}
          className="w-full shrink-0 touch-manipulation rounded bg-gray-800 px-4 py-2.5 text-white sm:w-auto sm:py-2"
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
              className={`touch-manipulation rounded border px-3 py-2 ${
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
                <input
                  value={editingClassName}
                  onChange={(event) => setEditingClassName(event.target.value)}
                  onBlur={saveClassEdit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    if (event.key === "Escape") setEditingClassId(null);
                  }}
                  className="w-32 min-w-0 rounded border px-2 py-2 sm:w-auto"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setClassId(String(classItem.class_id))}
                  className={`touch-manipulation rounded border px-3 py-2 ${
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
                      setEditingClassOriginalName(classItem.class_name_bn);
                    }}
                    aria-label="শ্রেণি এডিট করুন"
                    className="touch-manipulation rounded p-2 hover:bg-gray-100 active:bg-gray-200"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => removeClass(classItem.class_id)}
                    aria-label="শ্রেণি ডিলিট করুন"
                    className="touch-manipulation rounded p-2 hover:bg-red-50 active:bg-red-100"
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          ))}

          {isEditMode &&
            (!showClassInput ? (
              <button
                onClick={() => setShowClassInput(true)}
                className="touch-manipulation rounded border border-dashed px-3 py-2"
              >
                ➕ শ্রেণি যোগ করুন
              </button>
            ) : (
              <div className="flex w-full gap-2 sm:w-auto">
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  className="w-full min-w-0 rounded border px-2 py-2 sm:w-auto"
                  placeholder="শ্রেণির নাম"
                  autoFocus
                />
                <button
                  onClick={addClass}
                  className="touch-manipulation shrink-0 rounded bg-emerald-600 px-3 py-2 text-white"
                >
                  ✔
                </button>
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
              {isEditMode && " টেনে (drag) কিতাবের ক্রম যেভাবে ইচ্ছা সাজিয়ে নিন।"}
            </p>
          </div>
          <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            নির্বাচিত মিয়ারি: {miyariBookIds.length}টি
          </div>
        </div>

        {books.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-slate-400">
            কোনো কিতাব যোগ করা হয়নি
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {books.map((book) => {
              const isMiyari = miyariBookIds.includes(Number(book.book_id));
              return (
                <div
                  key={book.book_id}
                  data-book-id={book.book_id}
                  className={`flex w-auto max-w-full shrink-0 flex-col gap-2 rounded-lg border px-3 py-2.5 transition ${
                    isMiyari ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
                  } ${dragBookId === book.book_id ? "opacity-50" : ""}`}
                >
                  {editingId === book.book_id ? (
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded border px-2 py-1"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      {isEditMode && (
                        <span
                          onPointerDown={handleHandlePointerDown(book.book_id)}
                          onPointerMove={handleHandlePointerMove}
                          onPointerUp={handleHandlePointerEnd}
                          onPointerCancel={handleHandlePointerEnd}
                          className="shrink-0 cursor-grab select-none rounded p-1.5 text-slate-400 active:cursor-grabbing active:bg-gray-100"
                          style={{ touchAction: "none" }}
                          aria-label="কিতাব সরান"
                        >
                          ⠿
                        </span>
                      )}
                      <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                        {book.book_name_bn}
                      </span>

                      {isEditMode && (
                        <div className="flex shrink-0 gap-0.5 text-slate-500">
                          <button
                            onClick={() => startEdit(book)}
                            aria-label="কিতাব এডিট করুন"
                            className="touch-manipulation rounded p-1.5 hover:bg-gray-100 active:bg-gray-200"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => removeBook(book)}
                            aria-label="কিতাব ডিলিট করুন"
                            className="touch-manipulation rounded p-1.5 hover:bg-red-50 active:bg-red-100"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {isMiyari && !isEditMode && (
                    <span className="w-fit rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      মিয়ারি
                    </span>
                  )}

                  {isEditMode && (
                    <label className="flex cursor-pointer touch-manipulation items-center gap-2 py-1 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={isMiyari}
                        disabled={savingMiyari}
                        onChange={() => toggleMiyari(Number(book.book_id))}
                        className="h-5 w-5 disabled:cursor-not-allowed"
                      />
                      মিয়ারি কিতাব
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isEditMode && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!showBookInput ? (
              <button
                onClick={() => setShowBookInput(true)}
                className="touch-manipulation rounded border border-dashed px-3 py-2"
              >
                ➕ কিতাব যোগ করুন
              </button>
            ) : (
              <div className="flex w-full gap-2 sm:w-auto">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full min-w-0 rounded border px-2 py-2 sm:w-auto"
                  placeholder="কিতাবের নাম"
                  autoFocus
                />
                <button
                  onClick={addBook}
                  className="touch-manipulation shrink-0 rounded bg-emerald-600 px-3 py-2 text-white"
                >
                  ✔
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
