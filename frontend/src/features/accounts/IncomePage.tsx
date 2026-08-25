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

export default function IncomePage() {
  const toast = useToastStore();
  const { incomeFunds, paymentMethods, loading } = useAccountOptions();
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    fund: "",
    category: "",
    donor_name: "",
    address: "",
    mobile: "",
    amount: "",
    payment_method: "",
    note: "",
    entry_date: formatDateInput(new Date()),
    entry_time: nowTimeInput(),
  });

  // ফান্ড/খাত/পেমেন্ট মাধ্যম API থেকে লোড হওয়ার পর একবারই ডিফল্ট সেট করে দেয়
  useEffect(() => {
    if (!form.fund && incomeFunds.length) {
      const fund = incomeFunds[0];
      setForm((prev) => ({
        ...prev,
        fund: fund.name,
        category: fund.categories[0] ?? "",
      }));
    }
  }, [incomeFunds, form.fund]);

  useEffect(() => {
    if (!form.payment_method && paymentMethods.length) {
      setForm((prev) => ({ ...prev, payment_method: paymentMethods[0] }));
    }
  }, [paymentMethods, form.payment_method]);

  const selectedFund = useMemo(
    () => incomeFunds.find((fund) => fund.name === form.fund) || incomeFunds[0] || { name: "", categories: [] },
    [form.fund, incomeFunds],
  );
  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const handleFundChange = (fundName: string) => {
    const fund = incomeFunds.find((item) => item.name === fundName) || incomeFunds[0];
    if (!fund) return;
    setForm((prev) => ({ ...prev, fund: fund.name, category: fund.categories[0] ?? "" }));
  };

  const handleSubmit = async () => {
    if (!form.donor_name.trim()) return toast.push("error", "নাম দিন");
    if (!form.amount || !Number(form.amount) || Number(form.amount) <= 0) return toast.push("error", "পরিমাণ দিন");
    await api.post("/accounts/income", form);
    toast.push("success", "আয়/রশিদ জমা সংরক্ষণ হয়েছে");
    setForm((prev) => ({
      ...prev,
      donor_name: "",
      address: "",
      mobile: "",
      amount: "",
      note: "",
      entry_date: formatDateInput(new Date()),
      entry_time: nowTimeInput(),
    }));
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="রশিদ জমা / আয় এন্ট্রি"
        subtitle="কওমি মাদরাসার ফান্ডভিত্তিক আয় ও রশিদ জমা"
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>ফান্ড</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.fund}
                onChange={(e) => handleFundChange(e.target.value)}
                disabled={loading}
              >
                {incomeFunds.map((fund) => (
                  <option key={fund.name}>{fund.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>খাত</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                disabled={loading}
              >
                {selectedFund.categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
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
          <div>
            <FieldLabel required>নাম</FieldLabel>
            <Input
              required
              placeholder="দাতার নাম"
              value={form.donor_name}
              onChange={(e) => setField("donor_name", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>ঠিকানা</FieldLabel>
            <Input
              placeholder="ঠিকানা"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
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
            <p className="mt-1 text-xs text-slate-400">SMS পাঠানোর জন্য ব্যবহৃত হবে</p>
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

      <AccountRecentPanel type="income" adminBase={adminBase} refreshKey={refreshKey} />
    </div>
  );
}
