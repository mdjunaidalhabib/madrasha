import { useCallback, useEffect, useState } from "react";
import {
  paymentMethodSettingApi,
  type PaymentMethodSetting,
  type PaymentMethodType,
} from "../../services/phase2Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

const METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: "নগদ",
  BKASH: "বিকাশ",
  NAGAD: "নগদ (Nagad)",
  BANK: "ব্যাংক",
  OTHER: "অন্যান্য",
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

  const handleDelete = async (id: number) => {
    try {
      await paymentMethodSettingApi.remove(id);
      useToastStore.getState().show("পেমেন্ট পদ্ধতি মুছে ফেলা হয়েছে", "success");
      setMethods((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) resetForm();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">পেমেন্ট পদ্ধতি সেটআপ</h1>
          <p className="mt-1 text-sm text-gray-500">
            এখানে যেসব ম্যানুয়াল পেমেন্ট চ্যানেল (বিকাশ নম্বর, ব্যাংক অ্যাকাউন্ট, নগদ) যোগ করবেন,
            সেগুলো ফি পেমেন্ট রেকর্ড করার সময় বেছে নেওয়া যাবে। এখানে কোনো পেমেন্ট গেটওয়ে/অটো
            পেমেন্ট সিস্টেম নেই — এটি সম্পূর্ণ ম্যানুয়াল।
          </p>
        </div>

        {/* Add/Edit form */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            {editingId ? "পেমেন্ট পদ্ধতি সম্পাদনা করুন" : "নতুন পেমেন্ট পদ্ধতি যোগ করুন"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">ধরন</label>
              <select
                value={form.method_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, method_type: e.target.value as PaymentMethodType }))
                }
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              >
                {(Object.keys(METHOD_TYPE_LABELS) as PaymentMethodType[]).map((type) => (
                  <option key={type} value={type}>
                    {METHOD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                লেবেল (যেমন: বিকাশ - পার্সোনাল)
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                অ্যাকাউন্ট/নম্বর
              </label>
              <input
                type="text"
                value={form.account_number}
                onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
                placeholder="017XXXXXXXX / হিসাব নম্বর"
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                নামে (Account Name)
              </label>
              <input
                type="text"
                value={form.account_name}
                onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
              />
            </div>

            {form.method_type === "BANK" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    ব্যাংকের নাম
                  </label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">শাখা</label>
                  <input
                    type="text"
                    value={form.branch}
                    onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                নির্দেশনা (ঐচ্ছিক)
              </label>
              <textarea
                value={form.instructions}
                onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                rows={2}
                placeholder="যেমন: Send Money করুন, তারপর ট্রানজেকশন আইডি অফিসে জানান"
                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                বাতিল
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "সংরক্ষণ হচ্ছে..." : editingId ? "আপডেট করুন" : "যোগ করুন"}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
          {loading ? (
            <SkeletonList items={6} />
          ) : methods.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              এখনো কোনো পেমেন্ট পদ্ধতি যোগ করা হয়নি
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {METHOD_TYPE_LABELS[method.methodType]}
                    </span>{" "}
                    <span className="font-semibold text-gray-800">{method.label}</span>
                    {method.accountNumber && (
                      <span className="text-gray-600"> · {method.accountNumber}</span>
                    )}
                    {method.accountName && (
                      <span className="text-gray-500"> ({method.accountName})</span>
                    )}
                    {!method.isActive && (
                      <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                        নিষ্ক্রিয়
                      </span>
                    )}
                    {method.instructions && (
                      <p className="mt-1 text-xs text-gray-500">{method.instructions}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(method)}
                      className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      {method.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(method)}
                      className="h-8 rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      সম্পাদনা
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(method.id)}
                      className="h-8 rounded-md border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    >
                      মুছুন
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodSettingsPage;
