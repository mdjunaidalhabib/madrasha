import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Printer, Trash2 } from "lucide-react";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { logger } from "../../utils/logger";
import { useAccountOptions } from "./useAccountOptions";
import { AccountRow, AccountType, daysAgoInput, formatDateInput, money, partyName, toDateInput, toTimeInput } from "./accountHelpers";
import AccountReceiptModal from "./AccountReceiptModal";
import AccountEditModal from "./AccountEditModal";

const datePresets = [
  { key: "all", label: "সব", days: null },
  { key: "today", label: "আজ", days: 0 },
  { key: "3d", label: "গত ৩ দিন", days: 3 },
  { key: "7d", label: "গত ৭ দিন", days: 7 },
  { key: "15d", label: "গত ১৫ দিন", days: 15 },
  { key: "30d", label: "গত ৩০ দিন", days: 30 },
] as const;

const FieldLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
    {children} {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
  </label>
);

export default function AccountListPage() {
  const toast = useToastStore();
  const { incomeFunds, expenseGroups } = useAccountOptions();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type");
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"" | AccountType>(
    initialType === "income" || initialType === "expense" ? initialType : "",
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState(formatDateInput(new Date()));
  const [to, setTo] = useState(formatDateInput(new Date()));
  const [activePreset, setActivePreset] = useState<string>("today");

  const applyPreset = (preset: (typeof datePresets)[number]) => {
    setActivePreset(preset.key);
    if (preset.days === null) {
      setFrom("");
      setTo("");
      return;
    }
    setFrom(preset.days === 0 ? formatDateInput(new Date()) : daysAgoInput(preset.days));
    setTo(formatDateInput(new Date()));
  };

  const handleFromChange = (value: string) => {
    setActivePreset("");
    setFrom(value);
  };

  const handleToChange = (value: string) => {
    setActivePreset("");
    setTo(value);
  };

  const [editing, setEditing] = useState<AccountRow | null>(null);
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
  }, [typeFilter, incomeFunds, expenseGroups]);

  const handleTypeFilterChange = (value: "" | AccountType) => {
    setTypeFilter(value);
    setCategoryFilter("");
  };

  const closeEdit = () => setEditing(null);

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

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {datePresets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              activePreset === preset.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

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
          <Input type="date" className="h-10 w-40" value={from} onChange={(e) => handleFromChange(e.target.value)} />
        </div>
        <div>
          <FieldLabel>শেষ তারিখ</FieldLabel>
          <Input type="date" className="h-10 w-40" value={to} onChange={(e) => handleToChange(e.target.value)} />
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
                          onClick={() => setEditing(row)}
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

      <AccountEditModal row={editing} onClose={closeEdit} onSaved={load} />
      <AccountReceiptModal row={printingRow} onClose={() => setPrintingRow(null)} />
    </div>
  );
}
