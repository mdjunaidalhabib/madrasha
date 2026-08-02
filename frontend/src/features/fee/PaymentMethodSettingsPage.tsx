import { useCallback, useEffect, useState } from "react";
import { Banknote, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet, X } from "lucide-react";
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

const emptyForm = {
  method_type: "BKASH" as PaymentMethodType,
  label: "",
  account_name: "",
  account_number: "",
  bank_name: "",
  branch: "",
  instructions: "",
};

const fieldLabelClass = "mb-1 block text-xs font-medium text-gray-600";

/**
 * Admin panel setup screen for MANUAL payment methods only — there is no
 * payment gateway here. Admins add the channels guardians should pay
 * into (a bKash number, a bank account, "cash at office" etc); these then
 * show up as a picklist when recording a payment in Fee Management.
 */
const PaymentMethodSettingsPage = () => {
  const [methods, setMethods] = useState<PaymentMethodSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

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

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (method: PaymentMethodSetting) => {
    setEditingId(method.id);
    setForm({
      method_type: method.methodType,
      label: method.label,
      account_name: method.accountName || "",
      account_number: method.accountNumber || "",
      bank_name: method.bankName || "",
      branch: method.branch || "",
      instructions: method.instructions || "",
    });
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      useToastStore.getState().show("একটা নাম/লেবেল দিন (যেমন: বিকাশ - পার্সোনাল)", "error");
      return;
    }

    const payload = {
      method_type: form.method_type,
      label: form.label.trim(),
      account_name: form.account_name.trim() || undefined,
      account_number: form.account_number.trim() || undefined,
      bank_name: form.bank_name.trim() || undefined,
      branch: form.branch.trim() || undefined,
      instructions: form.instructions.trim() || undefined,
    };

    try {
      setSaving(true);
      if (editingId) {
        await paymentMethodSettingApi.update(editingId, payload);
        useToastStore.getState().show("পেমেন্ট পদ্ধতি আপডেট হয়েছে", "success");
      } else {
        await paymentMethodSettingApi.create(payload);
        useToastStore.getState().show("পেমেন্ট পদ্ধতি যোগ করা হয়েছে", "success");
      }
      resetForm();
      loadMethods();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সংরক্ষণ করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
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
          if (editingId === method.id) resetForm();
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="পেমেন্ট পদ্ধতি সেটআপ"
        subtitle="এখানে যেসব ম্যানুয়াল পেমেন্ট চ্যানেল (বিকাশ নম্বর, ব্যাংক অ্যাকাউন্ট, নগদ) যোগ করবেন, সেগুলো ফি পেমেন্ট রেকর্ড করার সময় বেছে নেওয়া যাবে। এখানে কোনো পেমেন্ট গেটওয়ে/অটো পেমেন্ট সিস্টেম নেই — এটি সম্পূর্ণ ম্যানুয়াল।"
      />

      {/* Add/Edit form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              {editingId ? <Pencil size={14} /> : <Plus size={14} />}
            </span>
            {editingId ? "পেমেন্ট পদ্ধতি সম্পাদনা করুন" : "নতুন পেমেন্ট পদ্ধতি যোগ করুন"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <X size={14} />
              বাতিল করে নতুন শুরু করুন
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={fieldLabelClass}>ধরন</label>
            <select
              value={form.method_type}
              onChange={(e) =>
                setForm((p) => ({ ...p, method_type: e.target.value as PaymentMethodType }))
              }
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              className="h-10"
            />
          </div>
          <div>
            <label className={fieldLabelClass}>অ্যাকাউন্ট/নম্বর</label>
            <Input
              type="text"
              value={form.account_number}
              onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
              placeholder="017XXXXXXXX / হিসাব নম্বর"
              className="h-10"
            />
          </div>
          <div>
            <label className={fieldLabelClass}>নামে (Account Name)</label>
            <Input
              type="text"
              value={form.account_name}
              onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))}
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
                  onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div>
                <label className={fieldLabelClass}>শাখা</label>
                <Input
                  type="text"
                  value={form.branch}
                  onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                  className="h-10"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className={fieldLabelClass}>নির্দেশনা (ঐচ্ছিক)</label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
              rows={2}
              placeholder="যেমন: Send Money করুন, তারপর ট্রানজেকশন আইডি অফিসে জানান"
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4">
          {editingId && (
            <Button variant="secondary" onClick={resetForm}>
              বাতিল
            </Button>
          )}
          <Button disabled={saving} onClick={handleSave} className="gap-1.5">
            {!saving && (editingId ? <Pencil size={15} /> : <Plus size={15} />)}
            {saving ? "সংরক্ষণ হচ্ছে..." : editingId ? "আপডেট করুন" : "যোগ করুন"}
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <SkeletonList items={4} />
      ) : methods.length === 0 ? (
        <EmptyState
          title="এখনো কোনো পেমেন্ট পদ্ধতি যোগ করা হয়নি"
          hint="উপরের ফর্ম থেকে প্রথম পেমেন্ট পদ্ধতিটি যোগ করুন।"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((method) => {
            const Icon = METHOD_TYPE_ICONS[method.methodType];
            return (
              <div
                key={method.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition ${
                  method.isActive ? "border-gray-200" : "border-gray-100 opacity-70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${METHOD_TYPE_STYLES[method.methodType]}`}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-gray-900">{method.label}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                        {METHOD_TYPE_LABELS[method.methodType]}
                      </span>
                      {!method.isActive && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          নিষ্ক্রিয়
                        </span>
                      )}
                    </div>
                    {(method.accountNumber || method.accountName) && (
                      <p className="mt-0.5 text-sm text-gray-600">
                        {method.accountNumber}
                        {method.accountNumber && method.accountName && " · "}
                        {method.accountName}
                      </p>
                    )}
                    {method.instructions && (
                      <p className="mt-1 text-xs text-gray-500">{method.instructions}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(method)}
                    className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {method.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(method)}
                    className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    <Pencil size={12} />
                    সম্পাদনা
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(method)}
                    className="flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 size={12} />
                    মুছুন
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaymentMethodSettingsPage;
