import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import ConfirmModal from "@madrasha/shared-ui/src/components/ui/ConfirmModal";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  catalogClassApi,
  catalogDivisionApi,
  defaultFeeStructureApi,
  type CatalogClassDto,
  type CatalogDivisionDto,
  type DefaultFeeFrequency,
  type DefaultFeeStructureDto,
} from "../../../services/superAdminCatalogApi";
import { INSTITUTION_TYPE_LABELS, commonText, formatCurrency, formatNumber, getText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { feeTemplatesText } from "./feeTemplates.text";

const FREQUENCIES: DefaultFeeFrequency[] = ["ONE_TIME", "MONTHLY", "YEARLY"];

type FeeFormValues = { name: string; amount: string; frequency: DefaultFeeFrequency };
const emptyFeeForm: FeeFormValues = { name: "", amount: "", frequency: "MONTHLY" };

export default function SuperAdminDefaultFeeStructuresPage() {
  const { show } = useToastStore();
  const t = useText(feeTemplatesText);
  const c = useText(commonText);
  const lang = useLang();
  const FREQUENCY_LABELS: Record<DefaultFeeFrequency, string> = t.frequency;

  const [divisions, setDivisions] = useState<CatalogDivisionDto[]>([]);
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<CatalogClassDto[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [items, setItems] = useState<DefaultFeeStructureDto[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [addForm, setAddForm] = useState<FeeFormValues>(emptyFeeForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<DefaultFeeStructureDto | null>(null);
  const [editForm, setEditForm] = useState<FeeFormValues>(emptyFeeForm);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DefaultFeeStructureDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await catalogDivisionApi.list();
      setDivisions(res.data?.data || []);
    } catch {
      show(getText(feeTemplatesText).divisionsLoadFailed, "error");
    }
  }, [show]);

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setClassLoading(true);
      const res = await catalogClassApi.list(Number(divisionId), false);
      setClasses(res.data?.data || []);
    } catch {
      show(getText(feeTemplatesText).classesLoadFailed, "error");
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await defaultFeeStructureApi.list();
      setItems(res.data?.data || []);
    } catch {
      show(getText(feeTemplatesText).itemsLoadFailed, "error");
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [show]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.amount) {
      show(t.nameAmountRequired, "error");
      return;
    }
    try {
      setSaving(true);
      await defaultFeeStructureApi.create({
        class_id: classId ? Number(classId) : null,
        name: addForm.name.trim(),
        amount: Number(addForm.amount),
        frequency: addForm.frequency,
      });
      show(t.created, "success");
      setAddForm(emptyFeeForm);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || t.createFailed, "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (item: DefaultFeeStructureDto) => {
    setEditTarget(item);
    setEditForm({ name: item.name, amount: String(item.amount), frequency: item.frequency });
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim() || !editForm.amount) {
      show(t.nameAmountRequired, "error");
      return;
    }
    try {
      setEditSaving(true);
      await defaultFeeStructureApi.update(editTarget.id, {
        name: editForm.name.trim(),
        amount: Number(editForm.amount),
        frequency: editForm.frequency,
      });
      show(t.updated, "success");
      setEditTarget(null);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || t.updateFailed, "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await defaultFeeStructureApi.remove(deleteTarget.id);
      show(t.deleted, "success");
      setDeleteTarget(null);
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
    } catch (err: any) {
      show(err?.response?.data?.message || c.deleteFailed, "error");
    } finally {
      setDeleting(false);
    }
  };

  // Grouped division → class so every template shows at once instead of
  // one class at a time — mirrors the admin panel's ছাত্র ফি ব্যবস্থাপনা
  // page. "সাধারণ" (no class, applies to every class) is pinned first as
  // its own section, then each division's classes alphabetically.
  const groupedItems = useMemo(() => {
    type ClassGroup = { key: string; label: string; items: DefaultFeeStructureDto[] };
    type DivisionGroup = { key: string; label: string; classGroups: ClassGroup[] };

    const genericItems = items.filter((r) => !r.class_id);
    const divisionMap = new Map<string, { label: string; classMap: Map<string, ClassGroup> }>();

    for (const row of items) {
      if (!row.class_id) continue;
      const divisionLabel = row.division_label || t.other;
      if (!divisionMap.has(divisionLabel)) {
        divisionMap.set(divisionLabel, { label: divisionLabel, classMap: new Map() });
      }
      const div = divisionMap.get(divisionLabel)!;
      const classKey = String(row.class_id);
      const classLabel = row.class_name || t.classNo(String(row.class_id));
      if (!div.classMap.has(classKey)) {
        div.classMap.set(classKey, { key: classKey, label: classLabel, items: [] });
      }
      div.classMap.get(classKey)!.items.push(row);
    }

    const divisionGroups: DivisionGroup[] = Array.from(divisionMap.entries())
      .map(([key, v]) => ({
        key,
        label: v.label,
        classGroups: Array.from(v.classMap.values()).sort((a, b) => a.label.localeCompare(b.label, "bn")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "bn"));

    const result: DivisionGroup[] = [];
    if (genericItems.length) {
      result.push({
        key: "generic",
        label: t.genericGroup,
        classGroups: [{ key: "generic-items", label: t.generic, items: genericItems }],
      });
    }
    return [...result, ...divisionGroups];
  }, [items, t]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {t.subtitle}
          </p>
        </div>

        {/* Division/Class picker */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            >
              <option value="">{t.divisionFilter}</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label || d.name} ({INSTITUTION_TYPE_LABELS[d.institution_type ?? "MADRASA"][lang]})
                </option>
              ))}
            </select>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={!division || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:w-[180px]"
            >
              <option value="">{classLoading ? c.loading : t.classFilter}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
            {t.createHeading} {classId ? t.forSelectedClass : t.forAllClasses}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder={t.namePlaceholder}
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[200px]"
            />
            <input
              type="number"
              placeholder={t.amountTaka}
              value={addForm.amount}
              onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[130px]"
            />
            <select
              value={addForm.frequency}
              onChange={(e) => setAddForm((p) => ({ ...p, frequency: e.target.value as DefaultFeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[130px]"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={handleAdd}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {c.create}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {loadingItems ? (
            <SkeletonList items={6} />
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">{t.empty}</div>
          ) : (
            <div className="space-y-5">
              {groupedItems.map((div) => (
                <div key={div.key}>
                  {div.key !== "generic" && <h3 className="mb-2 text-sm font-bold text-gray-700 dark:text-slate-300">{div.label}</h3>}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {div.classGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="truncate text-sm font-semibold text-gray-800 dark:text-slate-200">{group.label}</h4>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                            {t.count(formatNumber(group.items.length, lang))}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-gray-800 dark:text-slate-200">
                                  {item.name} <span className="font-normal text-gray-500 dark:text-slate-400">{formatCurrency(item.amount, lang)}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                                    {FREQUENCY_LABELS[item.frequency]}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  title={c.edit}
                                  onClick={() => openEditModal(item)}
                                  className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  title={c.delete}
                                  onClick={() => setDeleteTarget(item)}
                                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit fee template modal */}
      <Modal
        open={!!editTarget}
        title={t.editTitle(editTarget?.name || "")}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.name}</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.amountTaka}</label>
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">{t.frequencyLabel}</label>
            <select
              value={editForm.frequency}
              onChange={(e) => setEditForm((p) => ({ ...p, frequency: e.target.value as DefaultFeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={editSaving}
            onClick={handleUpdate}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editSaving ? c.saving : c.save}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title={t.deleteTitle}
        message={t.deleteMessage(deleteTarget?.name ?? "")}
        confirmText={c.delete}
        cancelText={c.cancel}
        danger
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
