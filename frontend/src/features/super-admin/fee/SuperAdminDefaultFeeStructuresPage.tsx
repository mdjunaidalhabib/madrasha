import { useCallback, useEffect, useState } from "react";
import { Check, Globe2, Pencil, Plus, Trash2, X } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import ConfirmModal from "../../../components/ui/ConfirmModal";
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

type Selection = { type: "generic" } | { type: "class"; classId: number };

type FeeFormValues = { name: string; amount: string; frequency: DefaultFeeFrequency };
const emptyFeeForm: FeeFormValues = { name: "", amount: "", frequency: "MONTHLY" };

/** Inline add row for a fee item — three fields (name/amount/frequency)
 * instead of the single-field AddRow used on the Academic Catalog page,
 * but same "+ add" reveal-on-click interaction. */
function FeeAddRow({ onAdd }: { onAdd: (values: FeeFormValues) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FeeFormValues>(emptyFeeForm);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.amount || saving) return;
    setSaving(true);
    try {
      await onAdd(form);
      setForm(emptyFeeForm);
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
        <Plus size={14} /> নতুন ফি টেমপ্লেট যোগ করুন
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 p-2">
      <input
        autoFocus
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        placeholder="নাম (যেমন: মাসিক বেতন)"
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
      />
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={form.amount}
          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          placeholder="পরিমাণ (৳)"
          className="w-full min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
        />
        <select
          value={form.frequency}
          onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as DefaultFeeFrequency }))}
          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
        >
          {(Object.keys(FREQUENCY_LABELS) as DefaultFeeFrequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
        <button type="button" onClick={submit} disabled={saving} className="shrink-0 rounded p-1.5 text-emerald-600 hover:bg-emerald-100">
          <Check size={15} />
        </button>
        <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function FeeRow({
  item,
  onSave,
  onDelete,
}: {
  item: DefaultFeeStructureDto;
  onSave: (values: FeeFormValues) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FeeFormValues>({ name: item.name, amount: String(item.amount), frequency: item.frequency });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.amount || saving) return;
    setSaving(true);
    try {
      await onSave(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-blue-200 bg-blue-50/40 p-2">
        <input
          autoFocus
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
        />
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            className="w-full min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
          />
          <select
            value={form.frequency}
            onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as DefaultFeeFrequency }))}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
          >
            {(Object.keys(FREQUENCY_LABELS) as DefaultFeeFrequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
          <button type="button" onClick={submit} disabled={saving} className="shrink-0 rounded p-1.5 text-emerald-600 hover:bg-emerald-100">
            <Check size={15} />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-200">
      <div className="min-w-0 flex-1">
        <span className="font-medium text-slate-800">{item.name}</span>{" "}
        <span className="text-slate-500">৳{item.amount}</span>{" "}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{FREQUENCY_LABELS[item.frequency]}</span>
      </div>
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

export default function SuperAdminDefaultFeeStructuresPage() {
  const { show } = useToastStore();

  const [divisions, setDivisions] = useState<CatalogDivisionDto[]>([]);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [loadingDivisions, setLoadingDivisions] = useState(true);

  const [classes, setClasses] = useState<CatalogClassDto[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [selection, setSelection] = useState<Selection>({ type: "generic" });

  const [items, setItems] = useState<DefaultFeeStructureDto[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<DefaultFeeStructureDto | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        const res = await catalogClassApi.list(divId, false);
        setClasses(res.data?.data || []);
      } catch {
        show("শ্রেণি লোড করা যায়নি", "error");
      } finally {
        setLoadingClasses(false);
      }
    },
    [show],
  );

  const loadItems = useCallback(
    async (sel: Selection) => {
      setLoadingItems(true);
      try {
        const res = await defaultFeeStructureApi.list(sel.type === "class" ? sel.classId : undefined);
        const rows = res.data?.data || [];
        setItems(sel.type === "generic" ? rows.filter((r) => r.class_id === null) : rows);
      } catch {
        show("ফি টেমপ্লেট লোড করা যায়নি", "error");
      } finally {
        setLoadingItems(false);
      }
    },
    [show],
  );

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  useEffect(() => {
    if (divisionId) loadClasses(divisionId);
    else setClasses([]);
  }, [divisionId, loadClasses]);

  useEffect(() => {
    loadItems(selection);
  }, [selection, loadItems]);

  const refreshItems = () => loadItems(selection);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await defaultFeeStructureApi.remove(deleteTarget.id);
      show("ফি টেমপ্লেট মুছে ফেলা হয়েছে", "success");
      setDeleteTarget(null);
      await refreshItems();
    } catch (err: any) {
      show(err?.response?.data?.message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setDeleting(false);
    }
  };

  const selectedClassLabel =
    selection.type === "generic" ? "সাধারণ (সব শ্রেণির জন্য)" : classes.find((c) => c.id === selection.classId)?.label || "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="ফি টেমপ্লেট"
        subtitle="নতুন মাদ্রাসা তৈরির সময় এই ফি কাঠামোগুলো স্বয়ংক্রিয়ভাবে কপি হয়ে যায়। টেনে নয়, ক্লিক করে ক্লাস বেছে নিন।"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* DIVISIONS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">বিভাগ</h2>
          <button
            type="button"
            onClick={() => setSelection({ type: "generic" })}
            className={`mb-2 flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              selection.type === "generic" ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 bg-white hover:border-blue-200"
            }`}
          >
            <Globe2 size={14} /> সাধারণ (সব শ্রেণির জন্য)
          </button>
          {loadingDivisions ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {divisions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDivisionId(d.id)}
                  className={`flex w-full items-center rounded-lg border px-3 py-2 text-left text-sm transition ${
                    divisionId === d.id && selection.type !== "generic"
                      ? "border-blue-400 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white hover:border-blue-200"
                  }`}
                >
                  {d.label || d.name}
                </button>
              ))}
              {!divisions.length && <p className="py-2 text-center text-xs text-slate-400">কোনো বিভাগ নেই</p>}
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
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelection({ type: "class", classId: c.id })}
                  className={`flex w-full items-center rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selection.type === "class" && selection.classId === c.id
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white hover:border-blue-200"
                  }`}
                >
                  {c.label || c.name}
                </button>
              ))}
              {!classes.length && <p className="py-2 text-center text-xs text-slate-400">কোনো শ্রেণি নেই</p>}
              <p className="pt-1 text-[11px] text-slate-400">শ্রেণি অ্যাড/এডিট করতে হলে একাডেমিক ক্যাটালগ পেজে যান।</p>
            </div>
          )}
        </div>

        {/* FEE ITEMS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">ফি — {selectedClassLabel}</h2>
          {loadingItems ? (
            <SkeletonList items={4} />
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <FeeRow
                  key={item.id}
                  item={item}
                  onSave={async (values) => {
                    await defaultFeeStructureApi.update(item.id, {
                      name: values.name.trim(),
                      amount: Number(values.amount),
                      frequency: values.frequency,
                    });
                    show("ফি টেমপ্লেট আপডেট হয়েছে", "success");
                    await refreshItems();
                  }}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
              {!items.length && <p className="py-2 text-center text-xs text-slate-400">কোনো ফি টেমপ্লেট নেই</p>}
              <FeeAddRow
                onAdd={async (values) => {
                  await defaultFeeStructureApi.create({
                    class_id: selection.type === "class" ? selection.classId : null,
                    name: values.name.trim(),
                    amount: Number(values.amount),
                    frequency: values.frequency,
                  });
                  show("ফি টেমপ্লেট তৈরি হয়েছে", "success");
                  await refreshItems();
                }}
              />
            </div>
          )}
        </div>
      </div>

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
