import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import ConfirmModal from "@madrasha/shared-ui/src/components/ui/ConfirmModal";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  catalogBookApi,
  catalogClassApi,
  catalogDivisionApi,
  type CatalogBookDto,
  type CatalogClassDto,
  type CatalogDivisionDto,
} from "../../../services/superAdminCatalogApi";
import {
  INSTITUTION_TYPES,
  INSTITUTION_TYPE_LABELS,
  TERMS,
  commonText,
  formatNumber,
  getText,
  useLang,
  useText,
  type InstitutionType,
} from "@madrasha/shared-ui/src/i18n";
import { catalogText } from "./catalog.text";

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
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-700 dark:hover:text-blue-400"
      >
        <Plus size={14} /> {placeholder}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 px-2 py-1.5 dark:border-blue-800 dark:bg-blue-950/40">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <button type="button" onClick={submit} disabled={saving} className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
        <Check size={15} />
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
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
  const t = useText(catalogText);
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
      <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 px-2 py-1.5 dark:border-blue-800 dark:bg-blue-950/40">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <button type="button" onClick={submit} disabled={saving} className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
          <Check size={15} />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div
      data-row-id={id}
      className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm transition ${
        selected
          ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
          : "border-slate-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
      } ${inactive ? "opacity-50" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <span
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerEnd}
        onPointerCancel={onDragHandlePointerEnd}
        className="shrink-0 cursor-grab select-none rounded p-1 text-slate-300 active:cursor-grabbing active:bg-slate-100 dark:text-slate-600 dark:active:bg-slate-800"
        style={{ touchAction: "none" }}
        aria-label={t.drag}
      >
        <GripVertical size={14} />
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate px-1 text-start">
        {label}
        {inactive && <span className="ms-1.5 text-[10px] text-slate-400 dark:text-slate-500">{t.inactiveTag}</span>}
      </button>
      {trailing}
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={t.edit}
        aria-label={t.edit}
        className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title={t.delete}
        aria-label={t.delete}
        className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-900/40 dark:hover:text-rose-400"
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
  const t = useText(catalogText);
  const c = useText(commonText);
  const lang = useLang();

  // Each institution type has its own catalogue; the tab picks which one is
  // shown/edited, and new divisions are created under it.
  const [typeTab, setTypeTab] = useState<InstitutionType>("MADRASA");
  const terms = TERMS[typeTab][lang];

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
      show(getText(commonText).loadFailed, "error");
    } finally {
      setLoadingDivisions(false);
    }
  }, [show]);

  // Divisions of the selected type (the full list stays in state because the
  // reorder endpoint needs every division id).
  const visibleDivisions = useMemo(
    () => divisions.filter((d) => (d.institution_type ?? "MADRASA") === typeTab),
    [divisions, typeTab],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<InstitutionType, number> = { MADRASA: 0, SCHOOL: 0, COLLEGE: 0, KINDERGARTEN: 0 };
    divisions.forEach((d) => {
      counts[d.institution_type ?? "MADRASA"] += 1;
    });
    return counts;
  }, [divisions]);

  // Keep the selected division inside the visible type's catalogue.
  useEffect(() => {
    if (loadingDivisions) return;
    if (!visibleDivisions.some((d) => d.id === divisionId)) {
      setDivisionId(visibleDivisions[0]?.id ?? null);
    }
  }, [visibleDivisions, divisionId, loadingDivisions]);

  const loadClasses = useCallback(
    async (divId: number) => {
      setLoadingClasses(true);
      try {
        const res = await catalogClassApi.list(divId);
        const rows = res.data?.data || [];
        setClasses(rows);
        setClassId(rows[0]?.id ?? null);
      } catch {
        show(getText(commonText).loadFailed, "error");
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
        show(getText(commonText).loadFailed, "error");
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
      show(t.orderFailed(terms.division), "error");
      loadDivisions();
    }
  });

  const classDrag = useDragReorder(classes, setClasses, async (ordered) => {
    if (!divisionId) return;
    try {
      await catalogClassApi.reorder(divisionId, ordered.map((c) => c.id));
    } catch {
      show(t.orderFailed(terms.class), "error");
      loadClasses(divisionId);
    }
  });

  const bookDrag = useDragReorder(books, setBooks, async (ordered) => {
    if (!classId) return;
    try {
      await catalogBookApi.reorder(classId, ordered.map((b) => b.id));
    } catch {
      show(t.orderFailed(terms.subject), "error");
      loadBooks(classId);
    }
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      if (confirmTarget.kind === "division") {
        await catalogDivisionApi.remove(confirmTarget.id);
        show(t.deleted(terms.division), "success");
        if (divisionId === confirmTarget.id) setDivisionId(null);
        await loadDivisions();
      } else if (confirmTarget.kind === "class") {
        await catalogClassApi.remove(confirmTarget.id);
        show(t.deleted(terms.class), "success");
        if (classId === confirmTarget.id) setClassId(null);
        if (divisionId) await loadClasses(divisionId);
      } else {
        await catalogBookApi.remove(confirmTarget.id);
        show(t.deleted(terms.subject), "success");
        if (classId) await loadBooks(classId);
      }
      setConfirmTarget(null);
    } catch (err: any) {
      show(err?.response?.data?.message || c.deleteFailed, "error");
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {/* Institution type tabs */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t.typeTabs}>
        {INSTITUTION_TYPES.map((type) => {
          const active = typeTab === type;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTypeTab(type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {INSTITUTION_TYPE_LABELS[type][lang]}
              <span
                className={`rounded-full px-1.5 text-[11px] ${
                  active ? "bg-white/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {formatNumber(typeCounts[type], lang)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* DIVISIONS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{terms.division}</h2>
          {loadingDivisions ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {visibleDivisions.map((d) => (
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
                    show(t.updated(terms.division), "success");
                    await loadDivisions();
                  }}
                  onDelete={() => setConfirmTarget({ kind: "division", id: d.id, label: d.label || d.name || "" })}
                  trailing={
                    <select
                      value={d.institution_type ?? "MADRASA"}
                      title={t.changeType}
                      aria-label={t.changeType}
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        const next = e.target.value as InstitutionType;
                        try {
                          await catalogDivisionApi.update(d.id, {
                            name_bn: d.label || d.name || "",
                            institution_type: next,
                          });
                          show(t.typeChanged, "success");
                          await loadDivisions();
                        } catch (err: any) {
                          show(err?.response?.data?.message || c.saveFailed, "error");
                        }
                      }}
                      className="shrink-0 cursor-pointer rounded-full border-0 bg-slate-100 py-0.5 pe-5 ps-2 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {INSTITUTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {INSTITUTION_TYPE_LABELS[type][lang]}
                        </option>
                      ))}
                    </select>
                  }
                />
              ))}
              {!visibleDivisions.length && <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">{t.none(terms.division)}</p>}
              <AddRow
                placeholder={t.addNew(terms.division)}
                onAdd={async (name) => {
                  await catalogDivisionApi.create({ name_bn: name, institution_type: typeTab });
                  show(t.created(terms.division), "success");
                  await loadDivisions();
                }}
              />
            </div>
          )}
        </div>

        {/* CLASSES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{terms.class}</h2>
          {!divisionId ? (
            <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">{t.selectFirst(terms.division)}</p>
          ) : loadingClasses ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {classes.map((cls) => (
                <Row
                  key={cls.id}
                  id={cls.id}
                  label={cls.label || cls.name || ""}
                  selected={classId === cls.id}
                  inactive={!cls.is_active}
                  dragging={classDrag.dragId === cls.id}
                  onSelect={() => setClassId(cls.id)}
                  onDragHandlePointerDown={classDrag.onPointerDown(cls.id)}
                  onDragHandlePointerMove={classDrag.onPointerMove}
                  onDragHandlePointerEnd={classDrag.onPointerEnd}
                  onSave={async (name) => {
                    await catalogClassApi.update(cls.id, { name_bn: name });
                    show(t.updated(terms.class), "success");
                    if (divisionId) await loadClasses(divisionId);
                  }}
                  onDelete={() => setConfirmTarget({ kind: "class", id: cls.id, label: cls.label || cls.name || "" })}
                  trailing={
                    <button
                      type="button"
                      title={cls.is_active ? t.deactivate : t.activate}
                      onClick={async () => {
                        await catalogClassApi.toggleActive(cls.id, !cls.is_active);
                        show(t.classStatusUpdated, "success");
                        if (divisionId) await loadClasses(divisionId);
                      }}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        cls.is_active
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {cls.is_active ? c.active : c.inactive}
                    </button>
                  }
                />
              ))}
              {!classes.length && <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">{t.none(terms.class)}</p>}
              <AddRow
                placeholder={t.addNew(terms.class)}
                onAdd={async (name) => {
                  await catalogClassApi.create({ division_id: divisionId, name_bn: name });
                  show(t.created(terms.class), "success");
                  if (divisionId) await loadClasses(divisionId);
                }}
              />
            </div>
          )}
        </div>

        {/* BOOKS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{terms.subject}</h2>
          {!classId ? (
            <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">{t.selectFirst(terms.class)}</p>
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
                    show(t.updated(terms.subject), "success");
                    if (classId) await loadBooks(classId);
                  }}
                  onDelete={() => setConfirmTarget({ kind: "book", id: b.id, label: b.label || b.name || "" })}
                />
              ))}
              {!books.length && <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">{t.none(terms.subject)}</p>}
              <AddRow
                placeholder={t.addNew(terms.subject)}
                onAdd={async (name) => {
                  await catalogBookApi.create({ class_id: classId, name_bn: name });
                  show(t.created(terms.subject), "success");
                  if (classId) await loadBooks(classId);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title={t.deleteTitle}
        message={t.deleteMessage(confirmTarget?.label ?? "")}
        confirmText={c.delete}
        cancelText={c.cancel}
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
