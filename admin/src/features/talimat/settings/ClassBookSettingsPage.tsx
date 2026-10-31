import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, GripVertical, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import MarkComponentsModal from "../../../components/ResultPanel/MarkComponentsModal";
import api, { cachedGet } from "../../../services/api";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import SectionCard from "../../../components/settings/SectionCard";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { commonText, formatNumber, getText, toAsciiDigits, useLang, useText, useInstitutionType } from "@madrasha/shared-ui/src/i18n";
import ProgressOverlay from "@madrasha/shared-ui/src/components/ui/ProgressOverlay";
import { useProgressTask } from "@madrasha/shared-ui/src/components/ui/useProgressTask";
import { talimatSettingsText } from "./talimatSettings.text";
import { talimatSettingsProgressText } from "./talimatSettings.progress.text";
import BulkSelection, { selectionCheckboxClass } from "./BulkSelection";

type BulkKind = "division" | "class" | "book";

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

/** Bangla (০-৯) or English digits both work - a type="number" input silently
 * rejects Bangla digits, which is why marks could not be typed on a Bangla
 * keyboard. Stored as plain ASCII digits. */
const cleanMarkInput = (raw: string) => toAsciiDigits(raw).replace(/[^0-9]/g, "");

const MarkField = ({
  label,
  value,
  onChange,
  onEnter,
  onEscape,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  onEscape: () => void;
  placeholder?: string;
}) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-400">
    {label}
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(cleanMarkInput(event.target.value))}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter();
        if (event.key === "Escape") onEscape();
      }}
      className="h-8 w-full"
    />
  </label>
);

/** Round "+" in a card header; turns into "×" while its add field is open. */
const PlusToggle = ({ open, onClick, label, disabled }: { open: boolean; onClick: () => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-expanded={open}
    title={label}
    className={`flex h-8 w-8 touch-manipulation items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
      open
        ? "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        : "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
    }`}
  >
    <Plus size={16} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
  </button>
);

/** Panel that slides open under a card header when "+" is pressed. */
const AddPanel = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 shadow-sm dark:border-blue-900 dark:bg-blue-950/20">
    {children}
  </div>
);

const iconBtn =
  "touch-manipulation rounded-md p-1.5 text-gray-400 dark:text-slate-500";
const editBtnCls = `${iconBtn} hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400`;
const copyBtnCls = `${iconBtn} hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400`;
const delBtnCls = `${iconBtn} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400`;

export default function ClassBookSettingsPage() {
  const t = useText(talimatSettingsText);
  const cm = useText(commonText);
  const lang = useLang();
  const num = (v: number | string) => formatNumber(v, lang);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<number[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<number[]>([]);
  const bulkRunning = useRef(false);

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

  const toast = useToastStore.getState().push;
  // Percentage overlay for copy / delete (same component as institution create/delete).
  const progressTask = useProgressTask();
  // Selection to apply after the next reload (a freshly added/duplicated row).
  const pendingClassSelect = useRef<string | null>(null);

  // DIVISION
  const [showDivisionInput, setShowDivisionInput] = useState(false);
  const [divisionName, setDivisionName] = useState("");
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
  const [newBookFullMarks, setNewBookFullMarks] = useState("");
  const [newBookPassMark, setNewBookPassMark] = useState("");
  const [dragBookId, setDragBookId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [componentsModalBook, setComponentsModalBook] = useState<{ id: number; name: string } | null>(
    null,
  );

  /* ================= LOAD ================= */

  // Keeps the current selection across reloads (rename/delete/add) instead of
  // jumping back to the first row; `select` forces a specific row ("last" = the
  // newly appended one).
  const loadDivisions = useCallback(async (select?: string) => {
    const res = await cachedGet("/madrasa-divisions");
    const data = res.data || [];

    setDivisions(data);
    setSelectedDivisions((prev) => prev.filter((id) => data.some((d: any) => Number(d.division_id) === id)));
    setDivisionId((prev) => {
      if (select === "last") return data.length ? String(data[data.length - 1].division_id) : "";
      if (select) return select;
      if (prev && data.some((d: any) => String(d.division_id) === prev)) return prev;
      return data.length ? String(data[0].division_id) : "";
    });
  }, []);

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  const addDivision = async () => {
    const trimmed = divisionName.trim();
    if (!trimmed) return;
    try {
      await api.post("/madrasa-divisions", { name_bn: trimmed });
      setDivisionName("");
      setShowDivisionInput(false);
      await loadDivisions("last");
    } catch (err: any) {
      toast("error", err?.response?.data?.message || t.addFailed);
    }
  };

  const duplicateDivision = (division: any) => {
    useConfirmStore.getState().show({
      title: t.duplicateDivision,
      message: t.duplicateDivisionMessage,
      confirmText: t.duplicateAction,
      onConfirm: async () => {
        const p = getText(talimatSettingsProgressText);
        try {
          const res = await progressTask.run(
            {
              title: p.duplicateDivisionTitle,
              estimate: { msPerStep: 900 },
              steps: [
                p.duplicateDivisionStepCheck,
                p.duplicateDivisionStepCreate,
                p.duplicateDivisionStepClasses,
                p.duplicateDivisionStepBooks,
                p.stepReload,
              ],
            },
            async () => {
              const r = await api.post(`/madrasa-divisions/${division.division_id}/duplicate`);
              await loadDivisions(String(r.data?.division_id));
              return r;
            },
          );
          toast("success", res.data?.message || t.duplicate);
        } catch (err: any) {
          toast("error", err?.response?.data?.message || t.addFailed);
        }
      },
    });
  };

  const removeDivision = (id: number) => {
    useConfirmStore.getState().show({
      title: t.deleteDivisionTitle,
      message: t.deleteDivisionMessage,
      confirmText: t.deleteAction,
      danger: true,
      onConfirm: async () => {
        const p = getText(talimatSettingsProgressText);
        try {
          await progressTask.run(
            {
              title: p.deleteDivisionTitle,
              estimate: { msPerStep: 700 },
              steps: [p.deleteDivisionStepCheck, p.deleteDivisionStepMove, p.stepReload],
            },
            async () => {
              await api.delete(`/madrasa-divisions/${id}`);
              await loadDivisions();
            },
          );
        } catch (err: any) {
          toast("error", err?.response?.data?.message || p.deleteFailed);
        }
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
    try {
      await api.put(`/madrasa-divisions/${id}`, { name_bn: trimmed });
    } catch (err: any) {
      toast("error", err?.response?.data?.message || t.editFailed);
    }
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
    setSelectedClasses((prev) => prev.filter((id) => data.some((c: any) => Number(c.class_id) === id)));

    const pending = pendingClassSelect.current;
    pendingClassSelect.current = null;
    setClassId((prev) => {
      if (pending === "last") return data.length ? String(data[data.length - 1].class_id) : "";
      if (pending) return pending;
      if (prev && data.some((c: any) => String(c.class_id) === prev)) return prev;
      return data.length ? String(data[0].class_id) : "";
    });
    if (!data.length) {
      setBooks([]);
      setMiyariBookIds([]);
      setOptionalBookIds([]);
    }
  }, [divisionId]);

  useEffect(() => {
    setSelectedClasses([]);
    setSelectedBooks([]);
    setClasses([]);
    setClassId("");
    setBooks([]);
    if (!divisionId) return;
    loadClasses();
  }, [divisionId, loadClasses]);

  const loadBooks = useCallback(async () => {
    const res = await cachedGet(`/madrasa-books?class_id=${classId}`);
    const data = res.data || [];
    setBooks(data);
    setSelectedBooks((prev) => prev.filter((id) => data.some((b: any) => Number(b.book_id) === id)));
    setMiyariBookIds(
      data.filter((book: any) => Boolean(book.is_miyari)).map((book: any) => Number(book.book_id)),
    );
    setOptionalBookIds(
      data.filter((book: any) => Boolean(book.is_optional)).map((book: any) => Number(book.book_id)),
    );
  }, [classId]);

  useEffect(() => {
    setSelectedBooks([]);
    setBooks([]);
    if (!classId) return;
    loadBooks();
  }, [classId, loadBooks]);

  /* ================= CLASS ================= */

  const addClass = async () => {
    if (!className.trim()) return;
    if (!divisionId) {
      toast("error", t.selectDivisionFirst);
      return;
    }

    try {
      await api.post("/madrasa-classes", {
        division_id: divisionId,
        name_bn: className.trim(),
      });
      setClassName("");
      setShowClassInput(false);
      pendingClassSelect.current = "last";
      await loadClasses();
    } catch (err: any) {
      pendingClassSelect.current = null;
      toast("error", err?.response?.data?.message || t.addFailed);
    }
  };

  const duplicateClass = (classItem: any) => {
    useConfirmStore.getState().show({
      title: t.duplicateClass,
      message: t.duplicateClassMessage,
      confirmText: t.duplicateAction,
      onConfirm: async () => {
        const p = getText(talimatSettingsProgressText);
        try {
          const res = await progressTask.run(
            {
              title: p.duplicateClassTitle,
              estimate: { msPerStep: 900 },
              steps: [
                p.duplicateClassStepCheck,
                p.duplicateClassStepCreate,
                p.duplicateClassStepBooks,
                p.stepReload,
              ],
            },
            async () => {
              const r = await api.post(`/madrasa-classes/${classItem.class_id}/duplicate`);
              pendingClassSelect.current = String(r.data?.class_id);
              await loadClasses();
              return r;
            },
          );
          toast("success", res.data?.message || t.duplicate);
        } catch (err: any) {
          pendingClassSelect.current = null;
          toast("error", err?.response?.data?.message || t.addFailed);
        }
      },
    });
  };

  const removeClass = (id: number) => {
    useConfirmStore.getState().show({
      title: t.deleteClassTitle,
      message: t.deleteClassMessage,
      confirmText: t.deleteAction,
      danger: true,
      onConfirm: async () => {
        const p = getText(talimatSettingsProgressText);
        try {
          await progressTask.run(
            {
              title: p.deleteClassTitle,
              estimate: { msPerStep: 700 },
              steps: [p.deleteClassStepCheck, p.deleteClassStepMove, p.stepReload],
            },
            async () => {
              await api.delete(`/madrasa-classes/${id}`);
              await loadClasses();
            },
          );
        } catch (err: any) {
          toast("error", err?.response?.data?.message || p.deleteFailed);
        }
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
    try {
      await api.put(`/madrasa-classes/${id}`, { name_bn: trimmed });
    } catch (err: any) {
      toast("error", err?.response?.data?.message || t.editFailed);
    }
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
    if (!classId) {
      toast("error", t.selectClassFirst);
      return;
    }

    const payload: Record<string, unknown> = { class_id: classId, name_bn: name.trim() };
    if (newBookFullMarks.trim()) {
      const fm = Number(newBookFullMarks);
      if (!Number.isFinite(fm) || fm <= 0) {
        toast("error", getText(talimatSettingsText).fullMarksInvalid);
        return;
      }
      payload.full_marks = fm;
    }
    if (newBookPassMark.trim()) {
      const pm = Number(newBookPassMark);
      const max = newBookFullMarks.trim() ? Number(newBookFullMarks) : 100;
      if (!Number.isFinite(pm) || pm < 0 || pm > max) {
        toast("error", getText(talimatSettingsText).passMarkInvalid);
        return;
      }
      payload.pass_mark = pm;
    }

    try {
      await api.post("/madrasa-books", payload);
      setName("");
      setNewBookFullMarks("");
      setNewBookPassMark("");
      setShowBookInput(false);
      await loadBooks();
    } catch (err: any) {
      toast("error", err?.response?.data?.message || t.addFailed);
    }
  };

  const duplicateBook = (book: any) => {
    useConfirmStore.getState().show({
      title: t.duplicateBook,
      message: t.duplicateBookMessage,
      confirmText: t.duplicateAction,
      onConfirm: async () => {
        const p = getText(talimatSettingsProgressText);
        try {
          const res = await progressTask.run(
            {
              title: p.duplicateBookTitle,
              estimate: { msPerStep: 800 },
              steps: [p.duplicateBookStepCheck, p.duplicateBookStepCopy, p.stepReload],
            },
            async () => {
              const r = await api.post(`/madrasa-books/${book.book_id}/duplicate`);
              await loadBooks();
              return r;
            },
          );
          toast("success", res.data?.message || t.duplicate);
        } catch (err: any) {
          toast("error", err?.response?.data?.message || t.addFailed);
        }
      },
    });
  };

  const removeBook = (book: any) => {
    useConfirmStore.getState().show({
      title: t.deleteBookTitle,
      message: t.deleteBookMessage(book.book_name_bn),
      confirmText: t.deleteAction,
      danger: true,
      onConfirm: async () => {
        const p = getText(talimatSettingsProgressText);
        try {
          await progressTask.run(
            {
              title: p.deleteBookTitle,
              estimate: { msPerStep: 800 },
              steps: [p.deleteBookStepCheck, p.deleteBookStepMove, p.deleteBookStepResults, p.stepReload],
            },
            async () => {
              await api.delete(`/madrasa-books/${book.book_id}`);
              await loadBooks();
            },
          );
        } catch (err: any) {
          toast("error", err?.response?.data?.message || p.deleteFailed);
        }
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

    const payload: Record<string, unknown> = {
      name_bn: nameChanged ? trimmed : editingOriginalName,
    };

    // Validate first and keep the editor open on a bad value, so what the
    // admin typed is not thrown away.
    let fullMarks: number | null = null;
    if (fullMarksChanged) {
      fullMarks = Number(fullMarksTrimmed);
      if (!fullMarksTrimmed || !Number.isFinite(fullMarks) || fullMarks <= 0) {
        toast("error", getText(talimatSettingsText).fullMarksInvalid);
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
          toast("error", getText(talimatSettingsText).passMarkInvalid);
          return;
        }
        payload.pass_mark = passMark;
      }
    }

    setEditingId(null);
    try {
      await api.put(`/madrasa-books/${id}`, payload);
    } catch (err: any) {
      toast("error", err?.response?.data?.message || t.editFailed);
    }
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

  const toggleSelected = (kind: BulkKind, id: number) => {
    const setter = kind === "division" ? setSelectedDivisions : kind === "class" ? setSelectedClasses : setSelectedBooks;
    setter((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);
  };

  const bulkAction = (kind: BulkKind, action: "duplicate" | "delete") => {
    if (bulkRunning.current || progressTask.isRunning) return;
    const rows = kind === "division" ? divisions : kind === "class" ? classes : books;
    const selected = kind === "division" ? selectedDivisions : kind === "class" ? selectedClasses : selectedBooks;
    const setter = kind === "division" ? setSelectedDivisions : kind === "class" ? setSelectedClasses : setSelectedBooks;
    const idKey = `${kind}_id`;
    const nameKey = `${kind}_name_bn`;
    const items = rows.filter((row) => selected.includes(Number(row[idKey])));
    if (!items.length) return;
    const title = action === "delete" ? t.deleteSelected : t.duplicateSelected;
    const endpoint = kind === "division" ? "/madrasa-divisions" : kind === "class" ? "/madrasa-classes" : "/madrasa-books";
    useConfirmStore.getState().show({
      title,
      message: `${t.bulkConfirm(num(items.length), kind === "division" ? t.divisions : kind === "class" ? t.classes : t.books)} ${action === "delete" ? t.bulkDeleteHint : t.bulkDuplicateHint}`,
      confirmText: action === "delete" ? t.deleteAction : t.duplicateAction,
      danger: action === "delete",
      onConfirm: async () => {
        if (bulkRunning.current) return;
        bulkRunning.current = true;
        const failed: number[] = [];
        try {
          await progressTask.run({
            title,
            steps: [...items.map((item) => item[nameKey]), getText(talimatSettingsProgressText).stepReload],
            failedWhen: () => failed.length > 0,
          }, async ({ advance }) => {
            for (const item of items) {
              try {
                if (action === "delete") await api.delete(`${endpoint}/${item[idKey]}`);
                else await api.post(`${endpoint}/${item[idKey]}/duplicate`);
              } catch {
                failed.push(Number(item[idKey]));
              }
              advance();
            }
            setter(failed);
            if (kind === "division") await loadDivisions();
            else if (kind === "class") await loadClasses();
            else await loadBooks();
            advance();
          });
          const completed = items.length - failed.length;
          if (completed) toast("success", t.bulkCompleted(num(completed)));
          if (failed.length) toast("error", t.bulkFailed(num(failed.length)));
        } catch (err: any) {
          toast("error", err?.response?.data?.message || cm.saveFailed);
        } finally {
          bulkRunning.current = false;
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t.classBookTitle}
        subtitle={t.classBookSubtitle}
      />

      <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard
        title={t.divisions}
        badge={t.countN(num(divisions.length))}
        actions={
          <PlusToggle
            open={showDivisionInput}
            label={t.addDivision}
            onClick={() => {
              setShowDivisionInput((v) => !v);
              setDivisionName("");
            }}
          />
        }
      >
        <BulkSelection ids={divisions.map((d) => Number(d.division_id))} selected={selectedDivisions}
          onChange={setSelectedDivisions} onAction={(action) => bulkAction("division", action)}
          disabled={progressTask.isRunning} formatCount={num} />
        <div className="flex flex-col gap-1.5">
          {showDivisionInput && (
            <AddPanel>
              <div className="flex w-full gap-2">
                <Input
                  value={divisionName}
                  onChange={(event) => setDivisionName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addDivision();
                    if (event.key === "Escape") setShowDivisionInput(false);
                  }}
                  className="h-9 w-full min-w-0"
                  placeholder={t.divisionName}
                  autoFocus
                />
                <Button onClick={addDivision} className="shrink-0 px-3" aria-label={t.addDivision}>
                  <Check size={16} />
                </Button>
              </div>
            </AddPanel>
          )}
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
                <input type="checkbox" className={selectionCheckboxClass}
                  aria-label={t.selectItem(division.division_name_bn)}
                  checked={selectedDivisions.includes(Number(division.division_id))}
                  disabled={progressTask.isRunning}
                  onChange={() => toggleSelected("division", Number(division.division_id))} />
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
                      title={t.editDivision}
                      className={editBtnCls}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => duplicateDivision(division)}
                      aria-label={t.duplicateDivision}
                      title={t.duplicateDivision}
                      className={copyBtnCls}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => removeDivision(division.division_id)}
                      aria-label={t.deleteDivisionTitle}
                      title={t.deleteDivisionTitle}
                      className={delBtnCls}
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

      <SectionCard
        title={t.classes}
        badge={t.countN(num(classes.length))}
        actions={
          <PlusToggle
            open={showClassInput}
            label={t.addClass}
            disabled={!divisionId}
            onClick={() => {
              setShowClassInput((v) => !v);
              setClassName("");
            }}
          />
        }
      >
        <BulkSelection ids={classes.map((c) => Number(c.class_id))} selected={selectedClasses}
          onChange={setSelectedClasses} onAction={(action) => bulkAction("class", action)}
          disabled={progressTask.isRunning} formatCount={num} />
        <div className="flex flex-col gap-1.5">
          {showClassInput && (
            <AddPanel>
              <div className="flex w-full gap-2">
                <Input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addClass();
                    if (event.key === "Escape") setShowClassInput(false);
                  }}
                  className="h-9 w-full min-w-0"
                  placeholder={t.className}
                  autoFocus
                />
                <Button onClick={addClass} className="shrink-0 px-3" aria-label={t.addClass}>
                  <Check size={16} />
                </Button>
              </div>
            </AddPanel>
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
                <input type="checkbox" className={selectionCheckboxClass}
                  aria-label={t.selectItem(classItem.class_name_bn)}
                  checked={selectedClasses.includes(Number(classItem.class_id))}
                  disabled={progressTask.isRunning}
                  onChange={() => toggleSelected("class", Number(classItem.class_id))} />
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
                      title={t.editClass}
                      className={editBtnCls}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => duplicateClass(classItem)}
                      aria-label={t.duplicateClass}
                      title={t.duplicateClass}
                      className={copyBtnCls}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => removeClass(classItem.class_id)}
                      aria-label={t.deleteClassTitle}
                      title={t.deleteClassTitle}
                      className={delBtnCls}
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

      <SectionCard
        title={t.books}
        badge={t.countN(num(books.length))}
        actions={
          <PlusToggle
            open={showBookInput}
            label={t.addBook}
            disabled={!classId}
            onClick={() => {
              setShowBookInput((v) => !v);
              setName("");
              setNewBookFullMarks("");
              setNewBookPassMark("");
            }}
          />
        }
      >
        <BulkSelection ids={books.map((b) => Number(b.book_id))} selected={selectedBooks}
          onChange={setSelectedBooks} onAction={(action) => bulkAction("book", action)}
          disabled={progressTask.isRunning} formatCount={num} />
        <div className="flex flex-col gap-1.5">
          {showBookInput && (
            <AddPanel>
              <div className="flex flex-col gap-2">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addBook();
                    if (event.key === "Escape") setShowBookInput(false);
                  }}
                  className="h-9 w-full min-w-0"
                  placeholder={t.bookName}
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <MarkField
                    label={t.fullMarks}
                    value={newBookFullMarks}
                    placeholder={num(100)}
                    onChange={setNewBookFullMarks}
                    onEnter={addBook}
                    onEscape={() => setShowBookInput(false)}
                  />
                  <MarkField
                    label={t.passMark}
                    value={newBookPassMark}
                    placeholder={t.global}
                    onChange={setNewBookPassMark}
                    onEnter={addBook}
                    onEscape={() => setShowBookInput(false)}
                  />
                </div>
                <p className="text-[11px] leading-tight text-gray-400 dark:text-slate-500">{t.markSetupHint}</p>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowBookInput(false)} className="px-3 py-1.5">
                    {cm.cancel}
                  </Button>
                  <Button onClick={addBook} className="px-3 py-1.5">
                    <Check size={15} className="me-1" />
                    {cm.save}
                  </Button>
                </div>
              </div>
            </AddPanel>
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
                        <input type="checkbox" className={selectionCheckboxClass}
                          aria-label={t.selectItem(book.book_name_bn)}
                          checked={selectedBooks.includes(Number(book.book_id))}
                          disabled={progressTask.isRunning}
                          onChange={() => toggleSelected("book", Number(book.book_id))} />
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
                        <MarkField
                          label={t.fullMarks}
                          value={editingFullMarks}
                          onChange={setEditingFullMarks}
                          onEnter={saveEdit}
                          onEscape={() => setEditingId(null)}
                        />
                        <MarkField
                          label={t.passMark}
                          value={editingPassMark}
                          placeholder={t.global}
                          onChange={setEditingPassMark}
                          onEnter={saveEdit}
                          onEscape={() => setEditingId(null)}
                        />
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
                      <input type="checkbox" className={selectionCheckboxClass}
                        aria-label={t.selectItem(book.book_name_bn)}
                        checked={selectedBooks.includes(Number(book.book_id))}
                        disabled={progressTask.isRunning}
                        onChange={() => toggleSelected("book", Number(book.book_id))} />
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
                        title={t.editBook}
                        className={editBtnCls}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => duplicateBook(book)}
                        aria-label={t.duplicateBook}
                        title={t.duplicateBook}
                        className={copyBtnCls}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => removeBook(book)}
                        aria-label={t.deleteBook}
                        title={t.deleteBook}
                        className={delBtnCls}
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

      <ProgressOverlay {...progressTask.overlayProps} />

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
