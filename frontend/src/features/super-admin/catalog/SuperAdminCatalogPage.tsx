import { useCallback, useEffect, useState } from "react";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import {
  catalogBookApi,
  catalogClassApi,
  catalogDivisionApi,
  type CatalogBookDto,
  type CatalogClassDto,
  type CatalogDivisionDto,
} from "../../../services/superAdminCatalogApi";

type ConfirmTarget = { kind: "division" | "class" | "book"; id: number; label: string };

/** Generic add-row: a "+ add" input that appears on demand, used for all
 * three columns below - Division/Class/Book only ever need a single
 * name_bn field to create. */
function AddRow({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setValue("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600"
      >
        <Plus size={14} /> {placeholder}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 px-2 py-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <button type="button" onClick={submit} disabled={saving} className="rounded p-1 text-emerald-600 hover:bg-emerald-100">
        <Check size={15} />
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
        <X size={15} />
      </button>
    </div>
  );
}

/** A single draggable, inline-editable row. Drag uses Pointer Events (not
 * HTML5 dnd) so the same handlers work for mouse/touch/pen — same approach
 * already proven in the tenant-side ClassPanel.tsx. The parent owns the
 * drag state (dragId) and does hit-testing via elementFromPoint + the
 * data-row-id attribute, since that has to compare against sibling rows. */
function Row({
  id,
  label,
  selected,
  inactive,
  dragging,
  onSelect,
  onSave,
  onDelete,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerEnd,
  trailing,
}: {
  id: number;
  label: string;
  selected?: boolean;
  inactive?: boolean;
  dragging?: boolean;
  onSelect?: () => void;
  onSave: (name: string) => Promise<void>;
  onDelete: () => void;
  onDragHandlePointerDown: (e: React.PointerEvent) => void;
  onDragHandlePointerMove: (e: React.PointerEvent) => void;
  onDragHandlePointerEnd: (e: React.PointerEvent) => void;
  trailing?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    if (trimmed === label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 px-2 py-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="button" onClick={submit} disabled={saving} className="rounded p-1 text-emerald-600 hover:bg-emerald-100">
          <Check size={15} />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div
      data-row-id={id}
      className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm transition ${
        selected ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 bg-white hover:border-blue-200"
      } ${inactive ? "opacity-50" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <span
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerEnd}
        onPointerCancel={onDragHandlePointerEnd}
        className="shrink-0 cursor-grab select-none rounded p-1 text-slate-300 active:cursor-grabbing active:bg-slate-100"
        style={{ touchAction: "none" }}
        aria-label="সরান"
      >
        <GripVertical size={14} />
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate px-1 text-left">
        {label}
        {inactive && <span className="ml-1.5 text-[10px] text-slate-400">(নিষ্ক্রিয়)</span>}
      </button>
      {trailing}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/** Local reorder (optimistic, while dragging) + persist (on drop) for one
 * column. Reused identically for divisions/classes/books below — only the
 * persist API call differs. */
function useDragReorder<T extends { id: number }>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  persist: (ordered: T[]) => Promise<void>,
) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reorderLocally = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setItems((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onPointerDown = (id: number) => (e: React.PointerEvent) => {
    if (saving) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragId === null) return;
    const hovered = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const row = hovered?.closest<HTMLElement>("[data-row-id]");
    const targetId = Number(row?.dataset.rowId);
    if (!targetId) return;
    reorderLocally(targetId);
  };

  const onPointerEnd = () => {
    if (dragId === null) return;
    setDragId(null);
    setSaving(true);
    persist(items).finally(() => setSaving(false));
  };

  return { dragId, onPointerDown, onPointerMove, onPointerEnd };
}

export default function SuperAdminCatalogPage() {
  const { show } = useToastStore();

  const [divisions, setDivisions] = useState<CatalogDivisionDto[]>([]);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [loadingDivisions, setLoadingDivisions] = useState(true);

  const [classes, setClasses] = useState<CatalogClassDto[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [books, setBooks] = useState<CatalogBookDto[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadDivisions = useCallback(async () => {
    setLoadingDivisions(true);
    try {
      const res = await catalogDivisionApi.list();
      const rows = res.data?.data || [];
      setDivisions(rows);
      setDivisionId((prev) => prev ?? rows[0]?.id ?? null);
    } catch {
      show("বিভাগ লোড করা যায়নি", "error");
    } finally {
      setLoadingDivisions(false);
    }
  }, [show]);

  const loadClasses = useCallback(
    async (divId: number) => {
      setLoadingClasses(true);
      try {
        const res = await catalogClassApi.list(divId);
        const rows = res.data?.data || [];
        setClasses(rows);
        setClassId(rows[0]?.id ?? null);
      } catch {
        show("শ্রেণি লোড করা যায়নি", "error");
      } finally {
        setLoadingClasses(false);
      }
    },
    [show],
  );

  const loadBooks = useCallback(
    async (clsId: number) => {
      setLoadingBooks(true);
      try {
        const res = await catalogBookApi.list(clsId);
        setBooks(res.data?.data || []);
      } catch {
        show("কিতাব লোড করা যায়নি", "error");
      } finally {
        setLoadingBooks(false);
      }
    },
    [show],
  );

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  useEffect(() => {
    setBooks([]);
    if (divisionId) loadClasses(divisionId);
    else {
      setClasses([]);
      setClassId(null);
    }
  }, [divisionId, loadClasses]);

  useEffect(() => {
    if (classId) loadBooks(classId);
    else setBooks([]);
  }, [classId, loadBooks]);

  const divisionDrag = useDragReorder(divisions, setDivisions, async (ordered) => {
    try {
      await catalogDivisionApi.reorder(ordered.map((d) => d.id));
    } catch {
      show("বিভাগের ক্রম সংরক্ষণ করা যায়নি", "error");
      loadDivisions();
    }
  });

  const classDrag = useDragReorder(classes, setClasses, async (ordered) => {
    if (!divisionId) return;
    try {
      await catalogClassApi.reorder(divisionId, ordered.map((c) => c.id));
    } catch {
      show("শ্রেণির ক্রম সংরক্ষণ করা যায়নি", "error");
      loadClasses(divisionId);
    }
  });

  const bookDrag = useDragReorder(books, setBooks, async (ordered) => {
    if (!classId) return;
    try {
      await catalogBookApi.reorder(classId, ordered.map((b) => b.id));
    } catch {
      show("কিতাবের ক্রম সংরক্ষণ করা যায়নি", "error");
      loadBooks(classId);
    }
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      if (confirmTarget.kind === "division") {
        await catalogDivisionApi.remove(confirmTarget.id);
        show("বিভাগ মুছে ফেলা হয়েছে", "success");
        if (divisionId === confirmTarget.id) setDivisionId(null);
        await loadDivisions();
      } else if (confirmTarget.kind === "class") {
        await catalogClassApi.remove(confirmTarget.id);
        show("শ্রেণি মুছে ফেলা হয়েছে", "success");
        if (classId === confirmTarget.id) setClassId(null);
        if (divisionId) await loadClasses(divisionId);
      } else {
        await catalogBookApi.remove(confirmTarget.id);
        show("কিতাব মুছে ফেলা হয়েছে", "success");
        if (classId) await loadBooks(classId);
      }
      setConfirmTarget(null);
    } catch (err: any) {
      show(err?.response?.data?.message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="একাডেমিক ক্যাটালগ"
        subtitle="বিভাগ, শ্রেণি ও কিতাব — সব মাদ্রাসার জন্য শেয়ার্ড global ক্যাটালগ। টেনে (drag) ক্রম সাজানো যায়। নতুন মাদ্রাসা তৈরির সময় এখান থেকে বেছে নেওয়া যায়।"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* DIVISIONS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">বিভাগ</h2>
          {loadingDivisions ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {divisions.map((d) => (
                <Row
                  key={d.id}
                  id={d.id}
                  label={d.label || d.name || ""}
                  selected={divisionId === d.id}
                  dragging={divisionDrag.dragId === d.id}
                  onSelect={() => setDivisionId(d.id)}
                  onDragHandlePointerDown={divisionDrag.onPointerDown(d.id)}
                  onDragHandlePointerMove={divisionDrag.onPointerMove}
                  onDragHandlePointerEnd={divisionDrag.onPointerEnd}
                  onSave={async (name) => {
                    await catalogDivisionApi.update(d.id, { name_bn: name });
                    show("বিভাগ আপডেট হয়েছে", "success");
                    await loadDivisions();
                  }}
                  onDelete={() => setConfirmTarget({ kind: "division", id: d.id, label: d.label || d.name || "" })}
                />
              ))}
              {!divisions.length && <p className="py-2 text-center text-xs text-slate-400">কোনো বিভাগ নেই</p>}
              <AddRow
                placeholder="নতুন বিভাগ যোগ করুন"
                onAdd={async (name) => {
                  await catalogDivisionApi.create({ name_bn: name });
                  show("বিভাগ তৈরি হয়েছে", "success");
                  await loadDivisions();
                }}
              />
            </div>
          )}
        </div>

        {/* CLASSES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">শ্রেণি</h2>
          {!divisionId ? (
            <p className="py-6 text-center text-xs text-slate-400">প্রথমে একটি বিভাগ নির্বাচন করুন</p>
          ) : loadingClasses ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {classes.map((c) => (
                <Row
                  key={c.id}
                  id={c.id}
                  label={c.label || c.name || ""}
                  selected={classId === c.id}
                  inactive={!c.is_active}
                  dragging={classDrag.dragId === c.id}
                  onSelect={() => setClassId(c.id)}
                  onDragHandlePointerDown={classDrag.onPointerDown(c.id)}
                  onDragHandlePointerMove={classDrag.onPointerMove}
                  onDragHandlePointerEnd={classDrag.onPointerEnd}
                  onSave={async (name) => {
                    await catalogClassApi.update(c.id, { name_bn: name });
                    show("শ্রেণি আপডেট হয়েছে", "success");
                    if (divisionId) await loadClasses(divisionId);
                  }}
                  onDelete={() => setConfirmTarget({ kind: "class", id: c.id, label: c.label || c.name || "" })}
                  trailing={
                    <button
                      type="button"
                      title={c.is_active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                      onClick={async () => {
                        await catalogClassApi.toggleActive(c.id, !c.is_active);
                        show("শ্রেণির অবস্থা আপডেট হয়েছে", "success");
                        if (divisionId) await loadClasses(divisionId);
                      }}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                    </button>
                  }
                />
              ))}
              {!classes.length && <p className="py-2 text-center text-xs text-slate-400">কোনো শ্রেণি নেই</p>}
              <AddRow
                placeholder="নতুন শ্রেণি যোগ করুন"
                onAdd={async (name) => {
                  await catalogClassApi.create({ division_id: divisionId, name_bn: name });
                  show("শ্রেণি তৈরি হয়েছে", "success");
                  if (divisionId) await loadClasses(divisionId);
                }}
              />
            </div>
          )}
        </div>

        {/* BOOKS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">কিতাব</h2>
          {!classId ? (
            <p className="py-6 text-center text-xs text-slate-400">প্রথমে একটি শ্রেণি নির্বাচন করুন</p>
          ) : loadingBooks ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {books.map((b) => (
                <Row
                  key={b.id}
                  id={b.id}
                  label={b.label || b.name || ""}
                  dragging={bookDrag.dragId === b.id}
                  onDragHandlePointerDown={bookDrag.onPointerDown(b.id)}
                  onDragHandlePointerMove={bookDrag.onPointerMove}
                  onDragHandlePointerEnd={bookDrag.onPointerEnd}
                  onSave={async (name) => {
                    await catalogBookApi.update(b.id, { name_bn: name });
                    show("কিতাব আপডেট হয়েছে", "success");
                    if (classId) await loadBooks(classId);
                  }}
                  onDelete={() => setConfirmTarget({ kind: "book", id: b.id, label: b.label || b.name || "" })}
                />
              ))}
              {!books.length && <p className="py-2 text-center text-xs text-slate-400">কোনো কিতাব নেই</p>}
              <AddRow
                placeholder="নতুন কিতাব যোগ করুন"
                onAdd={async (name) => {
                  await catalogBookApi.create({ class_id: classId, name_bn: name });
                  show("কিতাব তৈরি হয়েছে", "success");
                  if (classId) await loadBooks(classId);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title="মুছে ফেলুন?"
        message={`"${confirmTarget?.label ?? ""}" মুছে ফেলতে চান? এটি ব্যবহারে থাকলে (কোনো মাদ্রাসা/ছাত্র যুক্ত থাকলে) মুছে ফেলা যাবে না।`}
        confirmText="মুছে ফেলুন"
        cancelText="বাতিল"
        danger
        loading={confirmLoading}
        onClose={() => {
          if (confirmLoading) return;
          setConfirmTarget(null);
        }}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
