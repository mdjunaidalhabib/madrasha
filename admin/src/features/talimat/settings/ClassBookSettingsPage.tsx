import { useCallback, useEffect, useState } from "react";
import { Check, GripVertical, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import MarkComponentsModal from "../../../components/ResultPanel/MarkComponentsModal";
import api, { cachedGet } from "../../../services/api";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import SectionCard from "../../../components/settings/SectionCard";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { commonText, formatNumber, getText, useLang, useText, useInstitutionType } from "@madrasha/shared-ui/src/i18n";
import { talimatSettingsText } from "./talimatSettings.text";

/** ক্রমিক নম্বর: position within this madrasa's own list (lists arrive
 * already sorted by sortOrder and are re-spliced locally on drag), so it
 * always matches what reports/dropdowns elsewhere show. */
const SerialBadge = ({ index }: { index: number }) => {
  const t = useText(talimatSettingsText);
  const lang = useLang();
  const n = formatNumber(index + 1, lang);
  return (
    <span
      aria-label={t.serialN(n)}
      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 px-1 text-[11px] font-semibold tabular-nums text-gray-500 dark:bg-slate-800 dark:text-slate-400"
    >
      {n}
    </span>
  );
};

export default function ClassBookSettingsPage() {
  const t = useText(talimatSettingsText);
  const cm = useText(commonText);
  const lang = useLang();
  const num = (v: number | string) => formatNumber(v, lang);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [divisionId, setDivisionId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [miyariBookIds, setMiyariBookIds] = useState<number[]>([]);
  const [savingMiyari, setSavingMiyari] = useState(false);
  const [optionalBookIds, setOptionalBookIds] = useState<number[]>([]);
  const [savingOptional, setSavingOptional] = useState(false);
  // School/college grade by board GPA: every compulsory subject must pass, so
  // miyari is replaced by the 4th (optional) subject flag there.
  const institutionType = useInstitutionType();
  const gpaMode = institutionType === "SCHOOL" || institutionType === "COLLEGE";

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
  const [editingPassMark, setEditingPassMark] = useState("");
  const [editingOriginalPassMark, setEditingOriginalPassMark] = useState("");
  const [showBookInput, setShowBookInput] = useState(false);
  const [dragBookId, setDragBookId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [componentsModalBook, setComponentsModalBook] = useState<{ id: number; name: string } | null>(
    null,
  );

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
      title: t.deleteDivisionTitle,
      message: t.deleteDivisionMessage,
      confirmText: t.deleteAction,
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
      useToastStore.getState().push("error", err?.response?.data?.message || getText(talimatSettingsText).orderSaveFailed);
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
      setOptionalBookIds([]);
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
    setOptionalBookIds(
      data.filter((book: any) => Boolean(book.is_optional)).map((book: any) => Number(book.book_id)),
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
      title: t.deleteClassTitle,
      message: t.deleteClassMessage,
      confirmText: t.deleteAction,
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
      useToastStore.getState().push("error", err?.response?.data?.message || getText(talimatSettingsText).orderSaveFailed);
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
      title: t.deleteBookTitle,
      message: t.deleteBookMessage(book.book_name_bn),
      confirmText: t.deleteAction,
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
    const passMarkTrimmed = editingPassMark.trim();
    const passMarkChanged = passMarkTrimmed !== editingOriginalPassMark.trim();
    const nameChanged = Boolean(trimmed) && trimmed !== editingOriginalName.trim();

    if (!nameChanged && !fullMarksChanged && !passMarkChanged) {
      setEditingId(null);
      return;
    }

    const id = editingId;
    setEditingId(null);

    const payload: Record<string, unknown> = {
      name_bn: nameChanged ? trimmed : editingOriginalName,
    };

    let fullMarks: number | null = null;
    if (fullMarksChanged) {
      fullMarks = Number(fullMarksTrimmed);
      if (!fullMarksTrimmed || !Number.isFinite(fullMarks) || fullMarks <= 0) {
        useToastStore.getState().push("error", getText(talimatSettingsText).fullMarksInvalid);
        return;
      }
      payload.full_marks = fullMarks;
    }

    if (passMarkChanged) {
      if (passMarkTrimmed === "") {
        // Empty = clear the override, fall back to the global fail mark.
        payload.pass_mark = null;
      } else {
        const passMark = Number(passMarkTrimmed);
        const maxAllowed = fullMarks ?? Number(fullMarksTrimmed || 100);
        if (!Number.isFinite(passMark) || passMark < 0 || passMark > maxAllowed) {
          useToastStore
            .getState()
            .push("error", getText(talimatSettingsText).passMarkInvalid);
          return;
        }
        payload.pass_mark = passMark;
      }
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
    const passMark = book.pass_mark ?? "";
    setEditingPassMark(String(passMark));
    setEditingOriginalPassMark(String(passMark));
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
      useToastStore.getState().push("error", err?.response?.data?.message || getText(talimatSettingsText).orderSaveFailed);
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
  const toggleOptional = async (bookId: number) => {
    const previous = optionalBookIds;
    const next = previous.includes(bookId) ? previous.filter((id) => id !== bookId) : [...previous, bookId];
    setOptionalBookIds(next);
    setSavingOptional(true);
    try {
      const res = await api.put("/madrasa-books/optional", { class_id: Number(classId), book_ids: next });
      useToastStore.getState().push("success", res.data?.message || getText(talimatSettingsText).optionalSaved);
    } catch (err: any) {
      setOptionalBookIds(previous);
      useToastStore.getState().push("error", err?.response?.data?.message || getText(commonText).saveFailed);
    } finally {
      setSavingOptional(false);
    }
  };

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
      useToastStore.getState().push("success", res.data?.message || getText(talimatSettingsText).miyariSaved);
    } catch (err: any) {
      setMiyariBookIds(previous);
      useToastStore.getState().push("error", err?.response?.data?.message || getText(commonText).saveFailed);
    } finally {
      setSavingMiyari(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t.classBookTitle}
        subtitle={t.classBookSubtitle}
      />

      <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title={t.divisions} badge={t.countN(num(divisions.length))}>
        <div className="flex flex-col gap-1.5">
          {divisions.map((division, index) => {
            const isActiveDivision = divisionId === String(division.division_id);
            const isEditingThis = editingDivisionId === division.division_id;
            return (
              <div
                key={division.division_id}
                data-division-id={division.division_id}
                className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 transition ${
                  isEditingThis
                    ? "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20"
                    : isActiveDivision
                      ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                      : "border-gray-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
                } ${dragDivisionId === division.division_id ? "opacity-40" : ""}`}
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
                      className="h-8 w-full min-w-0"
                      autoFocus
                    />
                    <button
                      onClick={saveDivisionEdit}
                      aria-label={cm.save}
                      className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingDivisionId(null)}
                      aria-label={cm.cancel}
                      className="shrink-0 touch-manipulation rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-700"
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
                      className="shrink-0 cursor-grab select-none rounded p-1 text-gray-300 active:cursor-grabbing active:bg-gray-100 dark:text-slate-600 dark:active:bg-slate-800"
                      style={{ touchAction: "none" }}
                      aria-label={t.moveDivision}
                    >
                      <GripVertical size={14} />
                    </span>
                    <SerialBadge index={index} />
                    <button
                      onClick={() => setDivisionId(String(division.division_id))}
                      className={`min-w-0 flex-1 touch-manipulation truncate rounded-md px-1.5 py-1.5 text-start text-sm font-medium transition ${
                        isActiveDivision ? "text-blue-800 dark:text-blue-400" : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
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
                      aria-label={t.editDivision}
                      className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeDivision(division.division_id)}
                      aria-label={t.deleteDivisionTitle}
                      className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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

      <SectionCard title={t.classes} badge={t.countN(num(classes.length))}>
        <div className="flex flex-col gap-1.5">
          {!showClassInput ? (
              <button
                onClick={() => setShowClassInput(true)}
                className="touch-manipulation flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              >
                <Plus size={15} />
                {t.addClass}
              </button>
            ) : (
              <div className="flex w-full gap-2">
                <Input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  className="w-full min-w-0"
                  placeholder={t.className}
                  autoFocus
                />
                <Button onClick={addClass} className="shrink-0 px-3">
                  <Check size={16} />
                </Button>
              </div>
            )}

          {classes.map((classItem, index) => {
            const isEditingThis = editingClassId === classItem.class_id;
            return (
              <div
                key={classItem.class_id}
                data-class-id={classItem.class_id}
                className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 transition ${
                  isEditingThis
                    ? "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20"
                    : classId === String(classItem.class_id)
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                      : "border-gray-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
                } ${dragClassId === classItem.class_id ? "opacity-40" : ""}`}
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
                      className="h-8 w-full min-w-0"
                      autoFocus
                    />
                    <button
                      onClick={saveClassEdit}
                      aria-label={cm.save}
                      className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingClassId(null)}
                      aria-label={cm.cancel}
                      className="shrink-0 touch-manipulation rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-700"
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
                      className="shrink-0 cursor-grab select-none rounded p-1 text-gray-300 active:cursor-grabbing active:bg-gray-100 dark:text-slate-600 dark:active:bg-slate-800"
                      style={{ touchAction: "none" }}
                      aria-label={t.moveClass}
                    >
                      <GripVertical size={14} />
                    </span>
                    <SerialBadge index={index} />
                    <button
                      onClick={() => setClassId(String(classItem.class_id))}
                      className={`min-w-0 flex-1 touch-manipulation truncate rounded-md px-1.5 py-1.5 text-start text-sm font-medium transition ${
                        classId === String(classItem.class_id) ? "text-emerald-800 dark:text-emerald-400" : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
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
                      aria-label={t.editClass}
                      className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeClass(classItem.class_id)}
                      aria-label={t.deleteClassTitle}
                      className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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

      <SectionCard title={t.books} badge={t.countN(num(books.length))}>
        <div className="flex flex-col gap-1.5">
          {!showBookInput ? (
            <button
              onClick={() => setShowBookInput(true)}
              className="touch-manipulation flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            >
              <Plus size={15} />
              {t.addBook}
            </button>
          ) : (
            <div className="flex w-full gap-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addBook();
                  if (event.key === "Escape") setShowBookInput(false);
                }}
                className="w-full min-w-0"
                placeholder={t.bookName}
                autoFocus
              />
              <Button onClick={addBook} className="shrink-0 px-3">
                <Check size={16} />
              </Button>
            </div>
          )}

          {books.length > 0 && (
            <p className="px-1 text-[11px] leading-snug text-gray-400 dark:text-slate-500">
              {t.miyariSummary(num(miyariBookIds.length))}
            </p>
          )}

          {books.length === 0 ? (
            <EmptyState title={t.noBooks} />
          ) : (
            books.map((book, index) => {
              const isMiyari = miyariBookIds.includes(Number(book.book_id));
              const isEditingThis = editingId === book.book_id;
              return (
                <div
                  key={book.book_id}
                  data-book-id={book.book_id}
                  className={`rounded-lg border transition ${
                    isEditingThis
                      ? "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20"
                      : isMiyari
                        ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20"
                        : "border-gray-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
                  } ${dragBookId === book.book_id ? "opacity-40" : ""}`}
                >
                  {isEditingThis ? (
                    <div className="flex flex-col gap-2.5 p-2">
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveEdit();
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 w-full min-w-0"
                          placeholder={t.bookName}
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          aria-label={cm.save}
                          className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          aria-label={cm.cancel}
                          className="shrink-0 touch-manipulation rounded-md p-1.5 text-gray-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
                          {t.fullMarks}
                          <Input
                            type="number"
                            min={1}
                            value={editingFullMarks}
                            onChange={(event) => setEditingFullMarks(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveEdit();
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            className="h-8 w-full"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
                          {t.passMark}
                          <Input
                            type="number"
                            min={0}
                            placeholder={t.global}
                            value={editingPassMark}
                            onChange={(event) => setEditingPassMark(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveEdit();
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            className="h-8 w-full"
                          />
                        </label>
                      </div>
                      <p className="-mt-1 text-[11px] leading-tight text-gray-400 dark:text-slate-500">
                        {t.passMarkHint}
                      </p>

                      {gpaMode ? (
                        <label
                          className={`flex cursor-pointer touch-manipulation items-start gap-2 rounded-md border px-2 py-2 text-xs transition ${
                            optionalBookIds.includes(Number(book.book_id))
                              ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30"
                              : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={optionalBookIds.includes(Number(book.book_id))}
                            disabled={savingOptional}
                            onChange={() => toggleOptional(Number(book.book_id))}
                            className="mt-0.5 h-4 w-4 shrink-0 disabled:cursor-not-allowed dark:border-slate-600"
                          />
                          <span className="flex flex-col gap-0.5">
                            <span className="font-semibold text-gray-700 dark:text-slate-200">{t.optionalBook}</span>
                            <span className="leading-snug text-gray-500 dark:text-slate-400">{t.optionalHint}</span>
                          </span>
                        </label>
                      ) : (
                      <label
                        className={`flex cursor-pointer touch-manipulation items-start gap-2 rounded-md border px-2 py-2 text-xs transition ${
                          isMiyari
                            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                            : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isMiyari}
                          disabled={savingMiyari}
                          onChange={() => toggleMiyari(Number(book.book_id))}
                          className="mt-0.5 h-4 w-4 shrink-0 disabled:cursor-not-allowed dark:border-slate-600"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-semibold text-gray-700 dark:text-slate-200">{t.miyariBook}</span>
                          <span className="leading-snug text-gray-500 dark:text-slate-400">
                            {t.miyariHint}
                          </span>
                        </span>
                      </label>
                      )}

                      <button
                        onClick={() => setComponentsModalBook({ id: book.book_id, name: book.book_name_bn })}
                        className="flex touch-manipulation items-center justify-center gap-1.5 rounded-md border border-indigo-200 px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                      >
                        <SlidersHorizontal size={13} />
                        {t.markComponents}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-1.5 py-1.5">
                      <span
                        onPointerDown={handleHandlePointerDown(book.book_id)}
                        onPointerMove={handleHandlePointerMove}
                        onPointerUp={handleHandlePointerEnd}
                        onPointerCancel={handleHandlePointerEnd}
                        className="shrink-0 cursor-grab select-none rounded p-1 text-gray-300 active:cursor-grabbing active:bg-gray-100 dark:text-slate-600 dark:active:bg-slate-800"
                        style={{ touchAction: "none" }}
                        aria-label={t.moveBook}
                      >
                        <GripVertical size={14} />
                      </span>
                      <SerialBadge index={index} />
                      <div className="flex min-w-0 flex-1 flex-col px-1.5 py-0.5">
                        <span
                          className="truncate text-sm font-medium text-gray-800 dark:text-slate-100"
                          title={book.book_name_bn}
                        >
                          {book.book_name_bn}
                        </span>
                        <span className="flex flex-wrap items-center gap-1 text-[11px] leading-tight text-gray-400 dark:text-slate-500">
                          <span>{t.fullMarksN(num(book.full_marks ?? 100))}</span>
                          {book.pass_mark != null && (
                            <span className="text-sky-600 dark:text-sky-400" title={t.ownPassMark}>
                              {t.passN(num(book.pass_mark))}
                            </span>
                          )}
                          {isMiyari && (
                            <span className="rounded bg-amber-100 px-1 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                              {t.miyari}
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => startEdit(book)}
                        aria-label={t.editBook}
                        className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => removeBook(book)}
                        aria-label={t.deleteBook}
                        className="touch-manipulation rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
      </div>

      {componentsModalBook && (
        <MarkComponentsModal
          open
          bookId={componentsModalBook.id}
          bookLabel={componentsModalBook.name}
          onClose={() => setComponentsModalBook(null)}
        />
      )}
    </div>
  );
}
