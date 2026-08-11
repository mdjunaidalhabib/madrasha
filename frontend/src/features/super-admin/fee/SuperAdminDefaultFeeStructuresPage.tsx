import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Modal from "../../../components/ui/Modal";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import {
  catalogClassApi,
  catalogDivisionApi,
  defaultFeeStructureApi,
  type CatalogClassDto,
  type CatalogDivisionDto,
  type DefaultFeeFrequency,
  type DefaultFeeStructureDto,
} from "../../../services/superAdminCatalogApi";

const FREQUENCY_LABELS: Record<DefaultFeeFrequency, string> = {
  ONE_TIME: "একবার",
  MONTHLY: "মাসিক",
  YEARLY: "বাৎসরিক",
};

type FeeFormValues = { name: string; amount: string; frequency: DefaultFeeFrequency };
const emptyFeeForm: FeeFormValues = { name: "", amount: "", frequency: "MONTHLY" };

export default function SuperAdminDefaultFeeStructuresPage() {
  const { show } = useToastStore();

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
      show("বিভাগ লোড করা যায়নি", "error");
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
      show("শ্রেণি লোড করা যায়নি", "error");
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
      show("ফি টেমপ্লেট লোড করা যায়নি", "error");
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
      show("নাম ও পরিমাণ দিন", "error");
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
      show("ফি টেমপ্লেট তৈরি হয়েছে", "success");
      setAddForm(emptyFeeForm);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "ফি টেমপ্লেট তৈরি করতে সমস্যা হয়েছে", "error");
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
      show("নাম ও পরিমাণ দিন", "error");
      return;
    }
    try {
      setEditSaving(true);
      await defaultFeeStructureApi.update(editTarget.id, {
        name: editForm.name.trim(),
        amount: Number(editForm.amount),
        frequency: editForm.frequency,
      });
      show("ফি টেমপ্লেট আপডেট হয়েছে", "success");
      setEditTarget(null);
      await loadItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "ফি টেমপ্লেট আপডেট করতে সমস্যা হয়েছে", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await defaultFeeStructureApi.remove(deleteTarget.id);
      show("ফি টেমপ্লেট মুছে ফেলা হয়েছে", "success");
      setDeleteTarget(null);
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
    } catch (err: any) {
      show(err?.response?.data?.message || "মুছে ফেলা যায়নি", "error");
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
      const divisionLabel = row.division_label || "অন্যান্য";
      if (!divisionMap.has(divisionLabel)) {
        divisionMap.set(divisionLabel, { label: divisionLabel, classMap: new Map() });
      }
      const div = divisionMap.get(divisionLabel)!;
      const classKey = String(row.class_id);
      const classLabel = row.class_name || `শ্রেণি #${row.class_id}`;
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
        label: "সাধারণ (সব শ্রেণির জন্য)",
        classGroups: [{ key: "generic-items", label: "সাধারণ", items: genericItems }],
      });
    }
    return [...result, ...divisionGroups];
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">ফি টেমপ্লেট</h1>
          <p className="mt-1 text-sm text-gray-500">
            নতুন মাদ্রাসা তৈরির সময় এই ফি কাঠামোগুলো স্বয়ংক্রিয়ভাবে কপি হয়ে যায়
          </p>
        </div>

        {/* Division/Class picker */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[160px]"
            >
              <option value="">বিভাগ (ফিল্টার)</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label || d.name}
                </option>
              ))}
            </select>
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={!division || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
            >
              <option value="">{classLoading ? "লোড হচ্ছে..." : "শ্রেণি (ফিল্টার)"}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            নতুন ফি টেমপ্লেট তৈরি করুন {classId ? "(নির্বাচিত শ্রেণির জন্য)" : "(সব শ্রেণির জন্য)"}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder="নাম (যেমন: মাসিক বেতন)"
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[200px]"
            />
            <input
              type="number"
              placeholder="পরিমাণ (৳)"
              value={addForm.amount}
              onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[130px]"
            />
            <select
              value={addForm.frequency}
              onChange={(e) => setAddForm((p) => ({ ...p, frequency: e.target.value as DefaultFeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[130px]"
            >
              {(Object.keys(FREQUENCY_LABELS) as DefaultFeeFrequency[]).map((f) => (
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
              তৈরি করুন
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loadingItems ? (
            <SkeletonList items={6} />
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">কোনো ফি টেমপ্লেট নেই</div>
          ) : (
            <div className="space-y-5">
              {groupedItems.map((div) => (
                <div key={div.key}>
                  {div.key !== "generic" && <h3 className="mb-2 text-sm font-bold text-gray-700">{div.label}</h3>}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {div.classGroups.map((group) => (
                      <div key={group.key} className="rounded-xl border border-gray-200 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="truncate text-sm font-semibold text-gray-800">{group.label}</h4>
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            {group.items.length}টি
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-2 text-sm transition hover:border-blue-200"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-gray-800">
                                  {item.name} <span className="font-normal text-gray-500">৳{item.amount}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                    {FREQUENCY_LABELS[item.frequency]}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  title="এডিট"
                                  onClick={() => openEditModal(item)}
                                  className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="মুছুন"
                                  onClick={() => setDeleteTarget(item)}
                                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
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
        title={`ফি টেমপ্লেট এডিট করুন — ${editTarget?.name || ""}`}
        onClose={() => setEditTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">নাম</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">পরিমাণ (৳)</label>
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">ফ্রিকোয়েন্সি</label>
            <select
              value={editForm.frequency}
              onChange={(e) => setEditForm((p) => ({ ...p, frequency: e.target.value as DefaultFeeFrequency }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
            >
              {(Object.keys(FREQUENCY_LABELS) as DefaultFeeFrequency[]).map((f) => (
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
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={editSaving}
            onClick={handleUpdate}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="মুছে ফেলুন?"
        message={`"${deleteTarget?.name ?? ""}" ফি টেমপ্লেটটি মুছে ফেলতে চান?`}
        confirmText="মুছে ফেলুন"
        cancelText="বাতিল"
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
