import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Printer, Trash2 } from "lucide-react";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { logger } from "../../utils/logger";
import { incomeFunds, expenseGroups, paymentMethods } from "./accountingData";
import { AccountRow, AccountType, money, partyName, toDateInput, toTimeInput } from "./accountHelpers";
import AccountReceiptModal from "./AccountReceiptModal";

const FieldLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
    {children} {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
  </label>
);

type EditForm = {
  entry_date: string;
  entry_time: string;
  no: string;
  fund: string;
  group: string;
  category: string;
  name: string;
  address: string;
  amount: string;
  payment_method: string;
};

const emptyEditForm: EditForm = {
  entry_date: "",
  entry_time: "",
  no: "",
  fund: "",
  group: "",
  category: "",
  name: "",
  address: "",
  amount: "",
  payment_method: "",
};

const findExpenseGroup = (category: string) =>
  expenseGroups.find((group) => group.categories.includes(category)) || expenseGroups[0];

export default function AccountListPage() {
  const toast = useToastStore();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"" | AccountType>("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [printingRow, setPrintingRow] = useState<AccountRow | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get("/accounts", { params });
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(data);
    } catch (err) {
      logger.error("Accounts list load failed:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, categoryFilter, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          const amount = Number(row.amount || 0);
          if (row.type === "income") acc.income += amount;
          else acc.expense += amount;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [rows],
  );

  const categoryFilterOptions = useMemo(() => {
    if (typeFilter === "income") return incomeFunds.flatMap((f) => f.categories);
    if (typeFilter === "expense") return expenseGroups.flatMap((g) => g.categories);
    return [...new Set([...incomeFunds.flatMap((f) => f.categories), ...expenseGroups.flatMap((g) => g.categories)])];
  }, [typeFilter]);

  const handleTypeFilterChange = (value: "" | AccountType) => {
    setTypeFilter(value);
    setCategoryFilter("");
  };

  const categoryOptions = useMemo(() => {
    if (!editing) return [];
    if (editing.type === "income") {
      return incomeFunds.find((f) => f.name === editForm.fund)?.categories || [];
    }
    return expenseGroups.find((g) => g.name === editForm.group)?.categories || [];
  }, [editing, editForm.fund, editForm.group]);

  const openEdit = (row: AccountRow) => {
    setEditing(row);
    setEditForm({
      entry_date: toDateInput(row.entryDate),
      entry_time: toTimeInput(row.entryTime),
      no: (row.type === "income" ? row.receiptNo : row.voucherNo) || "",
      fund: row.fund || "",
      group: row.type === "expense" ? findExpenseGroup(row.category || "").name : "",
      category: row.category || "",
      name: partyName(row) === "-" ? "" : partyName(row),
      address: row.address || "",
      amount: String(row.amount ?? ""),
      payment_method: row.paymentMethod || paymentMethods[0],
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(emptyEditForm);
  };

  const setField = (key: keyof EditForm, value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const handleFundChange = (fundName: string) => {
    const fund = incomeFunds.find((f) => f.name === fundName);
    setEditForm((prev) => ({ ...prev, fund: fundName, category: fund?.categories[0] || "" }));
  };

  const handleGroupChange = (groupName: string) => {
    const group = expenseGroups.find((g) => g.name === groupName) || expenseGroups[0];
    setEditForm((prev) => ({ ...prev, group: group.name, category: group.categories[0] }));
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) return toast.push("error", "নাম দিন");
    if (!editForm.amount || Number(editForm.amount) <= 0) return toast.push("error", "পরিমাণ দিন");

    const payload: Record<string, string> = {
      entry_date: editForm.entry_date,
      entry_time: editForm.entry_time,
      fund: editing.type === "income" ? editForm.fund : editForm.group,
      category: editForm.category,
      amount: editForm.amount,
      payment_method: editForm.payment_method,
    };
    if (editing.type === "income") {
      payload.receipt_no = editForm.no;
      payload.donor_name = editForm.name;
      payload.address = editForm.address;
    } else {
      payload.voucher_no = editForm.no;
      payload.receiver_name = editForm.name;
    }

    try {
      setSaving(true);
      await api.patch(`/accounts/${editing.id}`, payload);
      toast.push("success", "এন্ট্রি আপডেট হয়েছে");
      closeEdit();
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে";
      toast.push("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: AccountRow) => {
    useConfirmStore.getState().show({
      title: "এন্ট্রি ডিলিট করুন",
      message: `"${partyName(row)}" এর ${money(row.amount)} টাকার এন্ট্রিটি মুছে ফেলতে চান?`,
      confirmText: "ডিলিট করুন",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/accounts/${row.id}`);
          toast.push("success", "এন্ট্রি মুছে ফেলা হয়েছে");
          setRows((prev) => prev.filter((r) => r.id !== row.id));
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
          toast.push("error", msg);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="সকল লেনদেন" subtitle="সব আয় ও ব্যয় এন্ট্রি — এডিট ও ডিলিট করুন" />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <FieldLabel>ধরন</FieldLabel>
          <select
            className="h-10 w-40 rounded border px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={typeFilter}
            onChange={(e) => handleTypeFilterChange(e.target.value as "" | AccountType)}
          >
            <option value="">সব</option>
            <option value="income">আয়</option>
            <option value="expense">ব্যয়</option>
          </select>
        </div>
        <div>
          <FieldLabel>খাত</FieldLabel>
          <select
            className="h-10 w-48 rounded border px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">সব খাত</option>
            {categoryFilterOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>শুরুর তারিখ</FieldLabel>
          <Input type="date" className="h-10 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <FieldLabel>শেষ তারিখ</FieldLabel>
          <Input type="date" className="h-10 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            মোট আয়: {money(totals.income)}
          </span>
          <span className="rounded-lg bg-rose-50 px-3 py-2 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            মোট ব্যয়: {money(totals.expense)}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="p-4">
            <SkeletonList items={6} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="কোনো এন্ট্রি পাওয়া যায়নি" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">নং</th>
                  <th className="px-4 py-3">ধরন</th>
                  <th className="px-4 py-3">ফান্ড / খাত</th>
                  <th className="px-4 py-3">নাম</th>
                  <th className="px-4 py-3">পরিমাণ</th>
                  <th className="px-4 py-3">মাধ্যম</th>
                  <th className="px-4 py-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">
                      {toDateInput(row.entryDate)} <span className="text-slate-400 dark:text-slate-500">{toTimeInput(row.entryTime)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {(row.type === "income" ? row.receiptNo : row.voucherNo) || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.type === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        {row.type === "income" ? "আয়" : "ব্যয়"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {row.fund} <span className="text-slate-400 dark:text-slate-500">/ {row.category}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{partyName(row)}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        row.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {money(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintingRow(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                          title={row.type === "income" ? "রশিদ প্রিন্ট" : "ভাউচার প্রিন্ট"}
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                          title="এডিট"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          title="মুছুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing}
        title={editing?.type === "income" ? "আয় এন্ট্রি এডিট করুন" : "ব্যয় এন্ট্রি এডিট করুন"}
        onClose={closeEdit}
        maxWidthClassName="max-w-2xl"
      >
        {editing && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>তারিখ</FieldLabel>
              <Input type="date" value={editForm.entry_date} onChange={(e) => setField("entry_date", e.target.value)} />
            </div>
            <div>
              <FieldLabel>সময়</FieldLabel>
              <Input type="time" value={editForm.entry_time} onChange={(e) => setField("entry_time", e.target.value)} />
            </div>
            <div>
              <FieldLabel>{editing.type === "income" ? "রশিদ নম্বর" : "ভাউচার নম্বর"}</FieldLabel>
              <Input value={editForm.no} onChange={(e) => setField("no", e.target.value)} />
            </div>
            <div>
              <FieldLabel>{editing.type === "income" ? "ফান্ড" : "ব্যয় বিভাগ"}</FieldLabel>
              {editing.type === "income" ? (
                <select
                  className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={editForm.fund}
                  onChange={(e) => handleFundChange(e.target.value)}
                >
                  {incomeFunds.map((fund) => (
                    <option key={fund.name}>{fund.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={editForm.group}
                  onChange={(e) => handleGroupChange(e.target.value)}
                >
                  {expenseGroups.map((group) => (
                    <option key={group.name}>{group.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <FieldLabel>খাত</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                {categoryOptions.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>নাম</FieldLabel>
              <Input required value={editForm.name} onChange={(e) => setField("name", e.target.value)} />
            </div>
            {editing.type === "income" && (
              <div>
                <FieldLabel>ঠিকানা</FieldLabel>
                <Input value={editForm.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
            )}
            <div>
              <FieldLabel required>পরিমাণ</FieldLabel>
              <Input
                required
                type="number"
                min="1"
                value={editForm.amount}
                onChange={(e) => setField("amount", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>পেমেন্ট মাধ্যম</FieldLabel>
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.payment_method}
                onChange={(e) => setField("payment_method", e.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 mt-2 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeEdit}>
                বাতিল
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <AccountReceiptModal row={printingRow} onClose={() => setPrintingRow(null)} />
    </div>
  );
}
