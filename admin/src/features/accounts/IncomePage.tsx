import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import AccountEntryLayout, {
  AccountEntrySection,
  AccountEntrySelect,
  FieldLabel,
} from "./AccountEntryLayout";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useAccountOptions } from "./useAccountOptions";
import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { formatDateInput } from "./accountHelpers";
import AccountRecentPanel from "./AccountRecentPanel";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { accountsText } from "./accounts.text";

const nowTimeInput = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function IncomePage() {
  const toast = useToastStore();
  const t = useText(accountsText);
  const c = useText(commonText);
  const { incomeFunds, paymentMethods, loading } = useAccountOptions();
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);
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
    () =>
      incomeFunds.find((fund) => fund.name === form.fund) ||
      incomeFunds[0] || { name: "", categories: [] },
    [form.fund, incomeFunds],
  );
  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const handleFundChange = (fundName: string) => {
    const fund = incomeFunds.find((item) => item.name === fundName) || incomeFunds[0];
    if (!fund) return;
    setForm((prev) => ({ ...prev, fund: fund.name, category: fund.categories[0] ?? "" }));
  };

  const invalidName = !form.donor_name.trim();
  const invalidAmount = !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (invalidName) return toast.push("error", t.enterName);
    if (invalidAmount) return toast.push("error", t.enterAmount);
    await api.post("/accounts/income", form);
    toast.push("success", t.incomeSaved);
    setSubmitted(false);
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <AccountEntryLayout
        title={t.incomeTitle}
        subtitle={t.incomeSubtitle}
        submitLabel={t.submitIncome}
        onSave={handleSubmit}
      >
        <AccountEntrySection title={t.entryDetails}>
          <label>
            <FieldLabel>{t.fund}</FieldLabel>
            <AccountEntrySelect
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.fund}
              onChange={(e) => handleFundChange(e.target.value)}
              disabled={loading}
            >
              {incomeFunds.map((fund) => (
                <option key={fund.name}>{fund.name}</option>
              ))}
            </AccountEntrySelect>
          </label>
          <label>
            <FieldLabel>{t.category}</FieldLabel>
            <AccountEntrySelect
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              disabled={loading}
            >
              {selectedFund.categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </AccountEntrySelect>
          </label>
          <label>
            <FieldLabel>{c.date}</FieldLabel>
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) => setField("entry_date", e.target.value)}
            />
          </label>
          <label>
            <FieldLabel>{t.time}</FieldLabel>
            <Input
              type="time"
              value={form.entry_time}
              onChange={(e) => setField("entry_time", e.target.value)}
            />
          </label>
        </AccountEntrySection>
        <AccountEntrySection title={t.donorDetails} kind="party">
          <label>
            <FieldLabel required>{c.name}</FieldLabel>
            <Input
              required
              placeholder={t.donorNamePlaceholder}
              invalid={submitted && invalidName}
              aria-invalid={submitted && invalidName}
              value={form.donor_name}
              onChange={(e) => setField("donor_name", e.target.value)}
            />
          </label>
          <label>
            <FieldLabel>{c.address}</FieldLabel>
            <Input
              placeholder={c.address}
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
            />
          </label>
          <label>
            <FieldLabel>{t.mobileNumber}</FieldLabel>
            <Input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={form.mobile}
              onChange={(e) => setField("mobile", e.target.value)}
            />
          </label>
        </AccountEntrySection>
        <AccountEntrySection title={t.paymentDetails} kind="payment">
          <label>
            <FieldLabel required>{c.amount}</FieldLabel>
            <Input
              required
              type="text"
              inputMode="decimal"
              invalid={submitted && invalidAmount}
              aria-invalid={submitted && invalidAmount}
              placeholder={c.amount}
              value={form.amount}
              onChange={(e) => setField("amount", normalizeBanglaDigits(e.target.value))}
            />
          </label>
          <label>
            <FieldLabel>{t.paymentMethod}</FieldLabel>
            <AccountEntrySelect
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.payment_method}
              onChange={(e) => setField("payment_method", e.target.value)}
              disabled={loading}
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </AccountEntrySelect>
          </label>
          <label className="sm:col-span-2 lg:col-span-1">
            <FieldLabel>{t.noteDescription}</FieldLabel>
            <textarea
              rows={1}
              placeholder={t.optionalNote}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
            />
          </label>
        </AccountEntrySection>
      </AccountEntryLayout>

      <AccountRecentPanel type="income" refreshKey={refreshKey} />
    </div>
  );
}
