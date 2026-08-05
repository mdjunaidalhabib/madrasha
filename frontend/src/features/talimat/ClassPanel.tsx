import { useCallback, useEffect, useState } from "react";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import api, { cachedGet } from "../../services/api";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import SectionCard from "../../components/settings/SectionCard";
import EmptyState from "../../components/ui/EmptyState";

export default function ClassPanel() {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [divisionId, setDivisionId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [miyariBookIds, setMiyariBookIds] = useState<number[]>([]);
  const [savingMiyari, setSavingMiyari] = useState(false);

  // DIVISION
  const [editingDivisionId, setEditingDivisionId] = useState<number | null>(null);
  const [editingDivisionName, setEditingDivisionName] = useState("");
  const [editingDivisionOriginalName, setEditingDivisionOriginalName] = useState("");
  const [dragDivisionId, setDragDivisionId] = useState<number | null>(null);
  const [savingDivisionOrder, setSavingDivisionOrder] = useState(false);

  // CLASS
  const [className, setClassName] = useState("");
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingClassName, setEditingClassName] = useState("");
  const [editingClassOriginalName, setEditingClassOriginalName] = useState("");
  const [showClassInput, setShowClassInput] = useState(false);
  const [dragClassId, setDragClassId] = useState<number | null>(null);
  const [savingClassOrder, setSavingClassOrder] = useState(false);

  // BOOK
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingOriginalName, setEditingOriginalName] = useState("");
  const [editingFullMarks, setEditingFullMarks] = useState("");
  const [editingOriginalFullMarks, setEditingOriginalFullMarks] = useState("");
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

  const removeDivision = (id: number) => {
    useConfirmStore.getState().show({
      title: "বিভাগ ডিলিট করুন",
      message: "বিভাগটি ট্রাশে পাঠাতে চান? পরে ট্রাশ থেকে ফিরিয়ে আনা যাবে।",
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/madrasa-divisions/${id}`);
        loadDivisions();
      },
    });
  };

  const saveDivisionEdit = async () => {
    const trimmed = editingDivisionName.trim();
    if (!trimmed || trimmed === editingDivisionOriginalName.trim()) {
      setEditingDivisionId(null);
      return;
    }

    const id = editingDivisionId;
    setEditingDivisionId(null);
    await api.put(`/madrasa-divisions/${id}`, {
      name_bn: trimmed,
    });

    loadDivisions();
  };

  /* ================= DIVISION ORDER (drag & drop) ================= */

  const reorderDivisionsLocally = (targetDivisionId: number) => {
    if (dragDivisionId === null || dragDivisionId === targetDivisionId) return;

    setDivisions((prev) => {
      const from = prev.findIndex((d: any) => d.division_id === dragDivisionId);
      const to = prev.findIndex((d: any) => d.division_id === targetDivisionId);
      if (from === -1 || to === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const persistDivisionOrder = async (orderedDivisions: any[]) => {
    setSavingDivisionOrder(true);
    try {
      await api.put("/madrasa-divisions/reorder", {
        division_ids: orderedDivisions.map((d) => d.division_id),
      });
    } catch (err: any) {
      useToastStore.getState().push("error", err?.response?.data?.message || "ক্রম সংরক্ষণ করা যায়নি");
      loadDivisions();
    } finally {
      setSavingDivisionOrder(false);
    }
  };

  const handleDivisionHandlePointerDown = (targetDivisionId: number) => (event: React.PointerEvent) => {
    if (savingDivisionOrder) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDragDivisionId(targetDivisionId);
  };

  const handleDivisionHandlePointerMove = (event: React.PointerEvent) => {
    if (dragDivisionId === null) return;
    const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const card = hovered?.closest<HTMLElement>("[data-division-id]");
    const targetDivisionId = Number(card?.dataset.divisionId);
    if (!targetDivisionId) return;
    reorderDivisionsLocally(targetDivisionId);
  };

  const handleDivisionHandlePointerEnd = () => {
    if (dragDivisionId === null) return;
    setDragDivisionId(null);
    persistDivisionOrder(divisions);
  };

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

  /* ================= CLASS ORDER (drag & drop) ================= */

  const reorderClassesLocally = (targetClassId: number) => {
    if (dragClassId === null || dragClassId === targetClassId) return;

    setClasses((prev) => {
      const from = prev.findIndex((c: any) => c.class_id === dragClassId);
      const to = prev.findIndex((c: any) => c.class_id === targetClassId);
      if (from === -1 || to === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const persistClassOrder = async (orderedClasses: any[]) => {
    setSavingClassOrder(true);
    try {
      await api.put("/madrasa-classes/reorder", {
        division_id: Number(divisionId),
        class_ids: orderedClasses.map((c) => c.class_id),
      });
    } catch (err: any) {
      useToastStore.getState().push("error", err?.response?.data?.message || "ক্রম সংরক্ষণ করা যায়নি");
      loadClasses();
    } finally {
      setSavingClassOrder(false);
    }
  };

  const handleClassHandlePointerDown = (targetClassId: number) => (event: React.PointerEvent) => {
    if (savingClassOrder) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDragClassId(targetClassId);
  };

  const handleClassHandlePointerMove = (event: React.PointerEvent) => {
    if (dragClassId === null) return;
    const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const card = hovered?.closest<HTMLElement>("[data-class-id]");
    const targetClassId = Number(card?.dataset.classId);
    if (!targetClassId) return;
    reorderClassesLocally(targetClassId);
  };

  const handleClassHandlePointerEnd = () => {
    if (dragClassId === null) return;
    setDragClassId(null);
    persistClassOrder(classes);
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

  const removeBook = (book: any) => {
    useConfirmStore.getState().show({
      title: "কিতাব ডিলিট করুন",
      message: `“${book.book_name_bn}” কিতাবটি ট্রাশে পাঠাতে চান? এর নম্বরসমূহ সংরক্ষিত থাকবে, ট্রাশ থেকে ফিরিয়ে আনা যাবে।`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/madrasa-books/${book.book_id}`);
        await loadBooks();
      },
    });
  };

  const saveEdit = async () => {
    const trimmed = editingName.trim();
    const fullMarksTrimmed = editingFullMarks.trim();
    const fullMarksChanged = fullMarksTrimmed !== editingOriginalFullMarks.trim();
    const nameChanged = Boolean(trimmed) && trimmed !== editingOriginalName.trim();

    if (!nameChanged && !fullMarksChanged) {
      setEditingId(null);
      return;
    }

    const id = editingId;
    setEditingId(null);

    const payload: Record<string, unknown> = {
      name_bn: nameChanged ? trimmed : editingOriginalName,
    };
    if (fullMarksChanged) {
      const fullMarks = Number(fullMarksTrimmed);
      if (!fullMarksTrimmed || !Number.isFinite(fullMarks) || fullMarks <= 0) {
        useToastStore.getState().push("error", "পূর্ণমান সঠিক সংখ্যা হতে হবে");
        return;
      }
      payload.full_marks = fullMarks;
    }

    await api.put(`/madrasa-books/${id}`, payload);
    loadBooks();
  };

  const startEdit = (book: any) => {
    setEditingId(book.book_id);
    setEditingName(book.book_name_bn);
    setEditingOriginalName(book.book_name_bn);
    setEditingFullMarks(String(book.full_marks ?? 100));
    setEditingOriginalFullMarks(String(book.full_marks ?? 100));
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
    if (savingOrder) return;
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="মাদরাসা শ্রেণি ও কিতাব ব্যবস্থাপনা"
        subtitle="প্রতিটি শ্রেণিতে প্রয়োজন অনুযায়ী এক বা একাধিক মিয়ারি কিতাব নির্ধারণ করুন। চেক/আনচেক করলেই সাথে সাথে সংরক্ষণ হয়ে যাবে — কোনো কিতাবই মিয়ারি না রাখলেও চলবে।"
      />

      <SectionCard title="বিভাগ" hint="টেনে (drag) বিভাগের ক্রম যেভাবে ইচ্ছা সাজিয়ে নিন।">
        <div className="flex flex-wrap gap-2">
          {divisions.map((division) => {
            const isActiveDivision = divisionId === String(division.division_id);
            const isEditingThis = editingDivisionId === division.division_id;
            return (
              <div
                key={division.division_id}
                data-division-id={division.division_id}
                className={`flex items-center gap-0.5 rounded-lg border p-1 transition ${
                  isEditingThis
                    ? "border-blue-300 bg-blue-50/40"
                    : isActiveDivision
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-200 bg-white"
                } ${dragDivisionId === division.division_id ? "opacity-50" : ""}`}
              >
                {isEditingThis ? (
                  <>
                    <Input
                      value={editingDivisionName}
                      onChange={(event) => setEditingDivisionName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveDivisionEdit();
                        if (event.key === "Escape") setEditingDivisionId(null);
                      }}
                      className="h-8 w-36 min-w-0 sm:w-48"
                      autoFocus
                    />
                    <button
                      onClick={saveDivisionEdit}
                      aria-label="সংরক্ষণ করুন"
                      className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingDivisionId(null)}
                      aria-label="বাতিল"
                      className="shrink-0 touch-manipulation rounded-md p-1.5 text-gray-500 hover:bg-gray-200"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      onPointerDown={handleDivisionHandlePointerDown(division.division_id)}
                      onPointerMove={handleDivisionHandlePointerMove}
                      onPointerUp={handleDivisionHandlePointerEnd}
                      onPointerCancel={handleDivisionHandlePointerEnd}
                      className={`shrink-0 cursor-grab select-none rounded p-1 active:cursor-grabbing ${
                        isActiveDivision ? "text-blue-100 active:bg-blue-700" : "text-gray-400 active:bg-gray-100"
                      }`}
                      style={{ touchAction: "none" }}
                      aria-label="বিভাগ সরান"
                    >
                      <GripVertical size={14} />
                    </span>
                    <button
                      onClick={() => setDivisionId(String(division.division_id))}
                      className={`touch-manipulation rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                        isActiveDivision ? "text-white" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {division.division_name_bn}
                    </button>
                    <button
                      onClick={() => {
                        setEditingDivisionId(division.division_id);
                        setEditingDivisionName(division.division_name_bn);
                        setEditingDivisionOriginalName(division.division_name_bn);
                      }}
                      aria-label="বিভাগ এডিট করুন"
                      className={`touch-manipulation rounded-md p-1.5 ${
                        isActiveDivision
                          ? "text-blue-100 hover:bg-blue-700"
                          : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeDivision(division.division_id)}
                      aria-label="বিভাগ ডিলিট করুন"
                      className={`touch-manipulation rounded-md p-1.5 ${
                        isActiveDivision
                          ? "text-blue-100 hover:bg-blue-700"
                          : "text-gray-400 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="শ্রেণি" hint="টেনে (drag) শ্রেণির ক্রম যেভাবে ইচ্ছা সাজিয়ে নিন।">
        <div className="flex flex-wrap gap-2">
          {classes.map((classItem) => {
            const isEditingThis = editingClassId === classItem.class_id;
            return (
              <div
                key={classItem.class_id}
                data-class-id={classItem.class_id}
                className={`flex items-center gap-0.5 rounded-lg border p-1 transition ${
                  isEditingThis ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-white"
                } ${dragClassId === classItem.class_id ? "opacity-50" : ""}`}
              >
                {isEditingThis ? (
                  <>
                    <Input
                      value={editingClassName}
                      onChange={(event) => setEditingClassName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveClassEdit();
                        if (event.key === "Escape") setEditingClassId(null);
                      }}
                      className="h-8 w-36 min-w-0 sm:w-48"
                      autoFocus
                    />
                    <button
                      onClick={saveClassEdit}
                      aria-label="সংরক্ষণ করুন"
                      className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingClassId(null)}
                      aria-label="বাতিল"
                      className="shrink-0 touch-manipulation rounded-md p-1.5 text-gray-500 hover:bg-gray-200"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      onPointerDown={handleClassHandlePointerDown(classItem.class_id)}
                      onPointerMove={handleClassHandlePointerMove}
                      onPointerUp={handleClassHandlePointerEnd}
                      onPointerCancel={handleClassHandlePointerEnd}
                      className="shrink-0 cursor-grab select-none rounded p-1 text-gray-400 active:cursor-grabbing active:bg-gray-100"
                      style={{ touchAction: "none" }}
                      aria-label="শ্রেণি সরান"
                    >
                      <GripVertical size={14} />
                    </span>
                    <button
                      onClick={() => setClassId(String(classItem.class_id))}
                      className={`touch-manipulation rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        classId === String(classItem.class_id)
                          ? "bg-emerald-600 text-white"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {classItem.class_name_bn}
                    </button>
                    <button
                      onClick={() => {
                        setEditingClassId(classItem.class_id);
                        setEditingClassName(classItem.class_name_bn);
                        setEditingClassOriginalName(classItem.class_name_bn);
                      }}
                      aria-label="শ্রেণি এডিট করুন"
                      className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeClass(classItem.class_id)}
                      aria-label="শ্রেণি ডিলিট করুন"
                      className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {!showClassInput ? (
              <button
                onClick={() => setShowClassInput(true)}
                className="touch-manipulation flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
              >
                <Plus size={15} />
                শ্রেণি যোগ করুন
              </button>
            ) : (
              <div className="flex w-full gap-2 sm:w-auto">
                <Input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  className="w-full min-w-0 sm:w-auto"
                  placeholder="শ্রেণির নাম"
                  autoFocus
                />
                <Button onClick={addClass} className="shrink-0 px-3">
                  <Check size={16} />
                </Button>
              </div>
            )}
        </div>
      </SectionCard>

      <SectionCard
        title="কিতাবসমূহ"
        hint="মিয়ারি কিতাবে ফেল করলে গড়ে পাস হলেও ফলাফল FAIL হবে। অন্য কিতাবে ফেল করলে গড় পাস থাকলে PASS হবে। টেনে (drag) কিতাবের ক্রম যেভাবে ইচ্ছা সাজিয়ে নিন।"
      >
        <div className="mb-3 flex justify-end">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            নির্বাচিত মিয়ারি: {miyariBookIds.length}টি
          </span>
        </div>

        {books.length === 0 ? (
          <EmptyState title="কোনো কিতাব যোগ করা হয়নি" />
        ) : (
          <div className="flex flex-wrap gap-3">
            {books.map((book) => {
              const isMiyari = miyariBookIds.includes(Number(book.book_id));
              return (
                <div
                  key={book.book_id}
                  data-book-id={book.book_id}
                  className={`flex w-auto max-w-full shrink-0 flex-col gap-2 rounded-xl border px-3 py-2.5 transition ${
                    editingId === book.book_id
                      ? "border-blue-200 bg-blue-50/40"
                      : isMiyari
                        ? "border-amber-300 bg-amber-50"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/60"
                  } ${dragBookId === book.book_id ? "opacity-50" : ""}`}
                >
                  {editingId === book.book_id ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveEdit();
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          aria-label="সংরক্ষণ করুন"
                          className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          aria-label="বাতিল"
                          className="shrink-0 touch-manipulation rounded-md p-2 text-gray-500 hover:bg-gray-200"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        পূর্ণমান
                        <Input
                          type="number"
                          min={1}
                          value={editingFullMarks}
                          onChange={(event) => setEditingFullMarks(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveEdit();
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 w-20"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span
                        onPointerDown={handleHandlePointerDown(book.book_id)}
                        onPointerMove={handleHandlePointerMove}
                        onPointerUp={handleHandlePointerEnd}
                        onPointerCancel={handleHandlePointerEnd}
                        className="shrink-0 cursor-grab select-none rounded p-1.5 text-gray-400 active:cursor-grabbing active:bg-gray-100"
                        style={{ touchAction: "none" }}
                        aria-label="কিতাব সরান"
                      >
                        <GripVertical size={15} />
                      </span>
                      <span className="min-w-0 flex-1 break-words font-medium leading-snug text-gray-900">
                        {book.book_name_bn}
                      </span>

                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => startEdit(book)}
                          aria-label="কিতাব এডিট করুন"
                          className="touch-manipulation rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => removeBook(book)}
                          aria-label="কিতাব ডিলিট করুন"
                          className="touch-manipulation rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {editingId !== book.book_id && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        পূর্ণমান {book.full_marks ?? 100}
                      </span>
                    </div>
                  )}

                  <label className="flex cursor-pointer touch-manipulation items-center gap-2 py-1 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={isMiyari}
                      disabled={savingMiyari}
                      onChange={() => toggleMiyari(Number(book.book_id))}
                      className="h-5 w-5 disabled:cursor-not-allowed"
                    />
                    মিয়ারি কিতাব
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!showBookInput ? (
            <button
              onClick={() => setShowBookInput(true)}
              className="touch-manipulation flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
            >
              <Plus size={15} />
              কিতাব যোগ করুন
            </button>
          ) : (
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full min-w-0 sm:w-auto"
                placeholder="কিতাবের নাম"
                autoFocus
              />
              <Button onClick={addBook} className="shrink-0 px-3">
                <Check size={16} />
              </Button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
