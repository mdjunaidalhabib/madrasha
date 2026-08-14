import { useCallback, useEffect, useState } from "react";
import { Banknote, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet } from "lucide-react";
import {
  paymentMethodSettingApi,
  type PaymentMethodSetting,
  type PaymentMethodType,
} from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import SectionCard from "../../components/settings/SectionCard";
import { ToggleSwitch } from "../../components/settings/ToggleSwitch";

const METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: "নগদ",
  BKASH: "বিকাশ",
  NAGAD: "নগদ (Nagad)",
  BANK: "ব্যাংক",
  OTHER: "অন্যান্য",
};

const METHOD_TYPE_ICONS: Record<PaymentMethodType, typeof Wallet> = {
  CASH: Banknote,
  BKASH: Smartphone,
  NAGAD: Smartphone,
  BANK: Landmark,
  OTHER: Wallet,
};

const METHOD_TYPE_STYLES: Record<PaymentMethodType, string> = {
  CASH: "bg-emerald-50 text-emerald-600",
  BKASH: "bg-pink-50 text-pink-600",
  NAGAD: "bg-orange-50 text-orange-600",
  BANK: "bg-blue-50 text-blue-600",
  OTHER: "bg-gray-100 text-gray-600",
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

type MethodForm = {
  method_type: PaymentMethodType;
  label: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch: string;
  instructions: string;
};

const emptyForm: MethodForm = {
  method_type: "BKASH",
  label: "",
  account_name: "",
  account_number: "",
  bank_name: "",
  branch: "",
  instructions: "",
};

const toFormValues = (method: PaymentMethodSetting): MethodForm => ({
  method_type: method.methodType,
  label: method.label,
  account_name: method.accountName || "",
  account_number: method.accountNumber || "",
  bank_name: method.bankName || "",
  branch: method.branch || "",
  instructions: method.instructions || "",
});

const toPayload = (form: MethodForm) => ({
  method_type: form.method_type,
  label: form.label.trim(),
  account_name: form.account_name.trim() || undefined,
  account_number: form.account_number.trim() || undefined,
  bank_name: form.bank_name.trim() || undefined,
  branch: form.branch.trim() || undefined,
  instructions: form.instructions.trim() || undefined,
});

const fieldLabelClass = "mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400";

function MethodFormFields({
  form,
  onChange,
}: {
  form: MethodForm;
  onChange: (patch: Partial<MethodForm>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={fieldLabelClass}>ধরন</label>
        <select
          value={form.method_type}
          onChange={(e) => onChange({ method_type: e.target.value as PaymentMethodType })}
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {(Object.keys(METHOD_TYPE_LABELS) as PaymentMethodType[]).map((type) => (
            <option key={type} value={type}>
              {METHOD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={fieldLabelClass}>লেবেল (যেমন: বিকাশ - পার্সোনাল)</label>
        <Input
          type="text"
          value={form.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-10"
        />
      </div>
      <div>
        <label className={fieldLabelClass}>অ্যাকাউন্ট/নম্বর</label>
        <Input
          type="text"
          value={form.account_number}
          onChange={(e) => onChange({ account_number: e.target.value })}
          placeholder="017XXXXXXXX / হিসাব নম্বর"
          className="h-10"
        />
      </div>
      <div>
        <label className={fieldLabelClass}>নামে (Account Name)</label>
        <Input
          type="text"
          value={form.account_name}
          onChange={(e) => onChange({ account_name: e.target.value })}
          className="h-10"
        />
      </div>

      {form.method_type === "BANK" && (
        <>
          <div>
            <label className={fieldLabelClass}>ব্যাংকের নাম</label>
            <Input
              type="text"
              value={form.bank_name}
              onChange={(e) => onChange({ bank_name: e.target.value })}
              className="h-10"
            />
          </div>
          <div>
            <label className={fieldLabelClass}>শাখা</label>
            <Input
              type="text"
              value={form.branch}
              onChange={(e) => onChange({ branch: e.target.value })}
              className="h-10"
            />
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <label className={fieldLabelClass}>নির্দেশনা (ঐচ্ছিক)</label>
        <textarea
          value={form.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          rows={2}
          placeholder="যেমন: Send Money করুন, তারপর ট্রানজেকশন আইডি অফিসে জানান"
          className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
    </div>
  );
}

/**
 * Admin panel setup screen for MANUAL payment methods only — there is no
 * payment gateway here. Admins add the channels guardians should pay
 * into (a bKash number, a bank account, "cash at office" etc); these then
 * show up as a picklist when recording a payment in Fee Management..
 */
const PaymentMethodSettingsPage = () => {
  const [methods, setMethods] = useState<PaymentMethodSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<MethodForm>(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MethodForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadMethods = useCallback(async () => {
    try {
      setLoading(true);
      const res = await paymentMethodSettingApi.list();
      setMethods(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD PAYMENT METHODS ERROR:", err);
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleCreate = async () => {
    if (!form.label.trim()) {
      useToastStore.getState().show("একটা নাম/লেবেল দিন (যেমন: বিকাশ - পার্সোনাল)", "error");
      return;
    }
    try {
      setCreating(true);
      await paymentMethodSettingApi.create(toPayload(form));
      useToastStore.getState().show("পেমেন্ট পদ্ধতি যোগ করা হয়েছে", "success");
      setForm(emptyForm);
      loadMethods();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (method: PaymentMethodSetting) => {
    setEditingId(method.id);
    setEditForm(toFormValues(method));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    if (!editForm.label.trim()) {
      useToastStore.getState().show("একটা নাম/লেবেল দিন (যেমন: বিকাশ - পার্সোনাল)", "error");
      return;
    }
    try {
      setSavingEdit(true);
      await paymentMethodSettingApi.update(editingId, toPayload(editForm));
      useToastStore.getState().show("পেমেন্ট পদ্ধতি আপডেট হয়েছে", "success");
      cancelEdit();
      loadMethods();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (method: PaymentMethodSetting) => {
    try {
      await paymentMethodSettingApi.update(method.id, { is_active: !method.isActive });
      setMethods((prev) =>
        prev.map((m) => (m.id === method.id ? { ...m, isActive: !m.isActive } : m)),
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleDelete = (method: PaymentMethodSetting) => {
    useConfirmStore.getState().show({
      title: "পেমেন্ট পদ্ধতি ডিলিট করুন",
      message: `"${method.label}" পদ্ধতিটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await paymentMethodSettingApi.remove(method.id);
          useToastStore.getState().show("পেমেন্ট পদ্ধতি মুছে ফেলা হয়েছে", "success");
          setMethods((prev) => prev.filter((m) => m.id !== method.id));
          if (editingId === method.id) cancelEdit();
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="পেমেন্ট পদ্ধতি সেটআপ"
        subtitle="এখানে যেসব ম্যানুয়াল পেমেন্ট চ্যানেল (বিকাশ নম্বর, ব্যাংক অ্যাকাউন্ট, নগদ) যোগ করবেন, সেগুলো ফি পেমেন্ট রেকর্ড করার সময় বেছে নেওয়া যাবে। এখানে কোনো পেমেন্ট গেটওয়ে/অটো পেমেন্ট সিস্টেম নেই — এটি সম্পূর্ণ ম্যানুয়াল।"
      />

      <SectionCard title="নতুন পেমেন্ট পদ্ধতি যোগ করুন">
        <MethodFormFields form={form} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} />
        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4 dark:border-slate-800">
          <Button disabled={creating} onClick={handleCreate} className="gap-1.5">
            {!creating && <Plus size={15} />}
            {creating ? "সংরক্ষণ হচ্ছে..." : "যোগ করুন"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="সব পেমেন্ট পদ্ধতি" hint="যেকোনো পদ্ধতির পেন্সিল আইকনে ক্লিক করলে সেটি এডিট করা যাবে">
        {loading ? (
          <SkeletonList items={4} />
        ) : methods.length === 0 ? (
          <EmptyState
            title="এখনো কোনো পেমেন্ট পদ্ধতি যোগ করা হয়নি"
            hint="উপরের ফর্ম থেকে প্রথম পেমেন্ট পদ্ধতিটি যোগ করুন।"
          />
        ) : (
          <div className="space-y-3">
            {methods.map((method) => {
              if (editingId === method.id && editForm) {
                return (
                  <div key={method.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <MethodFormFields
                      form={editForm}
                      onChange={(patch) => setEditForm((p) => (p ? { ...p, ...patch } : p))}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button type="button" variant="secondary" disabled={savingEdit} onClick={cancelEdit}>
                        বাতিল
                      </Button>
                      <Button type="button" disabled={savingEdit} onClick={saveEdit}>
                        {savingEdit ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                      </Button>
                    </div>
                  </div>
                );
              }

              const Icon = METHOD_TYPE_ICONS[method.methodType];
              return (
                <div
                  key={method.id}
                  className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${METHOD_TYPE_STYLES[method.methodType]}`}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-900 dark:text-slate-100">{method.label}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                          {METHOD_TYPE_LABELS[method.methodType]}
                        </span>
                        {!method.isActive && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                            নিষ্ক্রিয়
                          </span>
                        )}
                      </div>
                      {(method.accountNumber || method.accountName) && (
                        <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                          {method.accountNumber}
                          {method.accountNumber && method.accountName && " · "}
                          {method.accountName}
                        </p>
                      )}
                      {method.instructions && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{method.instructions}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <ToggleSwitch checked={method.isActive} onChange={() => handleToggleActive(method)} />
                    <button
                      type="button"
                      onClick={() => startEdit(method)}
                      className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
                      title="সম্পাদনা"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(method)}
                      className="rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                      title="মুছুন"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default PaymentMethodSettingsPage;
