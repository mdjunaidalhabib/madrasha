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

export default function ExpensePage() {
  const toast = useToastStore();
  const t = useText(accountsText);
  const c = useText(commonText);
  const { expenseGroups, paymentMethods, loading } = useAccountOptions();
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [form, setForm] = useState({
    category: "",
    amount: "",
    payment_method: "",
    receiver_name: "",
    address: "",
    mobile: "",
    note: "",
    entry_date: formatDateInput(new Date()),
    entry_time: nowTimeInput(),
  });
  const selectedGroup = useMemo(
    () =>
      expenseGroups.find((group) => group.name === groupName) ||
      expenseGroups[0] || { name: "", categories: [] },
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
    const group = expenseGroups.find((item) => item.name === name) ||
      expenseGroups[0] || { name: "", categories: [] };
    setGroupName(group.name);
    setForm((prev) => ({ ...prev, category: group.categories[0] || "" }));
  };
  const invalidName = !form.receiver_name.trim();
  const invalidAmount = !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (invalidName) return toast.push("error", t.enterExpenseSubject);
    if (invalidAmount) return toast.push("error", t.enterAmount);
    await api.post("/accounts/expense", { ...form, fund: groupName });
    toast.push("success", t.expenseSaved);
    setSubmitted(false);
    setForm((prev) => ({
      ...prev,
      amount: "",
      receiver_name: "",
      address: "",
      mobile: "",
      note: "",
      entry_date: formatDateInput(new Date()),
      entry_time: nowTimeInput(),
    }));
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <AccountEntryLayout
        title={t.expenseTitle}
        subtitle={t.expenseSubtitle}
        submitLabel={t.submitExpense}
        onSave={handleSubmit}
      >
        <AccountEntrySection title={t.entryDetails}>
          <label>
            <FieldLabel>{t.expenseGroup}</FieldLabel>
            <AccountEntrySelect
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={groupName}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={loading}
            >
              {!expenseGroups.length && <option value="">{c.loading}</option>}
              {expenseGroups.map((group) => (
                <option key={group.name}>{group.name}</option>
              ))}
            </AccountEntrySelect>
          </label>
          <label>
            <FieldLabel>{t.expenseCategory}</FieldLabel>
            <AccountEntrySelect
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              disabled={loading}
            >
              {!selectedGroup.categories.length && <option value="">{c.loading}</option>}
              {selectedGroup.categories.map((category) => (
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
        <AccountEntrySection title={t.receiverDetails} kind="party">
          <label>
            <FieldLabel required>{t.expenseSubject}</FieldLabel>
            <Input
              required
              placeholder={t.receiverNamePlaceholder}
              invalid={submitted && invalidName}
              aria-invalid={submitted && invalidName}
              value={form.receiver_name}
              onChange={(e) => setField("receiver_name", e.target.value)}
            />
          </label>
          <label>
            <FieldLabel>{c.address}</FieldLabel>
            <Input
              maxLength={255}
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
              {!paymentMethods.length && <option value="">{c.loading}</option>}
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

      <AccountRecentPanel type="expense" refreshKey={refreshKey} />
    </div>
  );
}
