import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useToastStore } from "../../store/toastStore";
import { useAccountOptions } from "./useAccountOptions";
import { normalizeBanglaDigits } from "../../utils/reportUtils";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { formatDateInput } from "./accountHelpers";
import AccountRecentPanel from "./AccountRecentPanel";

const nowTimeInput = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const FieldLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
    {children} {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
  </label>
);

export default function ExpensePage() {
  const toast = useToastStore();
  const { expenseGroups, paymentMethods, loading } = useAccountOptions();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const [refreshKey, setRefreshKey] = useState(0);
  const [groupName, setGroupName] = useState("");
  const [form, setForm] = useState({
    category: "",
    amount: "",
    payment_method: "",
    receiver_name: "",
    mobile: "",
    note: "",
    entry_date: formatDateInput(new Date()),
    entry_time: nowTimeInput(),
  });
  const selectedGroup = useMemo(
    () => expenseGroups.find((group) => group.name === groupName) || expenseGroups[0] || { name: "", categories: [] },
    [expenseGroups, groupName],
  );
  useEffect(() => {
    if (!groupName && expenseGroups.length) {
      const group = expenseGroups[0];
      setGroupName(group.name);
      setForm((prev) => ({ ...prev, category: group.categories[0] || "" }));
    }
  }, [expenseGroups, groupName]);
  useEffect(() => {
    if (!form.payment_method && paymentMethods.length) {
      setForm((prev) => ({ ...prev, payment_method: paymentMethods[0] }));
    }
  }, [paymentMethods, form.payment_method]);
  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const handleGroupChange = (name: string) => {
    const group = expenseGroups.find((item) => item.name === name) || expenseGroups[0] || { name: "", categories: [] };
    setGroupName(group.name);
    setForm((prev) => ({ ...prev, category: group.categories[0] || "" }));
  };
  const handleSubmit = async () => {
    if (!form.receiver_name.trim()) return toast.push("error", "নাম দিন");
    if (!form.amount || !Number(form.amount) || Number(form.amount) <= 0) return toast.push("error", "পরিমাণ দিন");
    await api.post("/accounts/expense", { ...form, fund: groupName });
    toast.push("success", "ব্যয়/ভাউচার সংরক্ষণ হয়েছে");
    setForm((prev) => ({
      ...prev,
      amount: "",
      receiver_name: "",
      mobile: "",
      note: "",
      entry_date: formatDateInput(new Date()),
      entry_time: nowTimeInput(),
    }));
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="ভাউচার তৈরি / ব্যয় এন্ট্রি"
        subtitle="ফান্ডভিত্তিক ভাউচার ও ব্যয় সংরক্ষণ"
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>তারিখ</FieldLabel>
              <Input type="date" value={form.entry_date} onChange={(e) => setField("entry_date", e.target.value)} />
            </div>
            <div>
              <FieldLabel>সময়</FieldLabel>
              <Input type="time" value={form.entry_time} onChange={(e) => setField("entry_time", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>ব্যয় বিভাগ</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={groupName}
                onChange={(e) => handleGroupChange(e.target.value)}
                disabled={loading}
              >
                {!expenseGroups.length && <option value="">লোড হচ্ছে...</option>}
                {expenseGroups.map((group) => (
                  <option key={group.name}>{group.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>ব্যয়ের খাত</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                disabled={loading}
              >
                {!selectedGroup.categories.length && <option value="">লোড হচ্ছে...</option>}
                {selectedGroup.categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel required>নাম</FieldLabel>
            <Input
              required
              placeholder="গ্রহণকারীর নাম"
              value={form.receiver_name}
              onChange={(e) => setField("receiver_name", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>মোবাইল নম্বর</FieldLabel>
            <Input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={form.mobile}
              onChange={(e) => setField("mobile", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>পরিমাণ</FieldLabel>
              <Input
                required
                type="text"
                inputMode="decimal"
                placeholder="পরিমাণ"
                value={form.amount}
                onChange={(e) => setField("amount", normalizeBanglaDigits(e.target.value))}
              />
            </div>
            <div>
              <FieldLabel>পেমেন্ট মাধ্যম</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.payment_method}
                onChange={(e) => setField("payment_method", e.target.value)}
                disabled={loading}
              >
                {!paymentMethods.length && <option value="">লোড হচ্ছে...</option>}
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel>নোট / বিবরণ</FieldLabel>
            <textarea
              rows={2}
              placeholder="ঐচ্ছিক নোট"
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} className="w-full rounded-xl px-8">
            সংরক্ষণ করুন
          </Button>
        </div>
      </div>

      <AccountRecentPanel type="expense" adminBase={adminBase} refreshKey={refreshKey} />
    </div>
  );
}
