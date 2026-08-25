import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Printer, Trash2 } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { SkeletonList } from "../../components/ui/Skeleton";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { AccountRow, AccountType, money, partyName, toDateInput, toTimeInput } from "./accountHelpers";
import AccountReceiptModal from "./AccountReceiptModal";
import AccountEditModal from "./AccountEditModal";

const RECENT_LIMIT = 8;

type Props = {
  type: AccountType;
  adminBase: string;
  refreshKey: number;
};

export default function AccountRecentPanel({ type, adminBase, refreshKey }: Props) {
  const toast = useToastStore();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingRow, setPrintingRow] = useState<AccountRow | null>(null);
  const [editingRow, setEditingRow] = useState<AccountRow | null>(null);
  const isIncome = type === "income";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/accounts", { params: { type } });
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(data.slice(0, RECENT_LIMIT));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

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
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            সাম্প্রতিক {isIncome ? "আয়" : "ব্যয়"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">সর্বশেষ {RECENT_LIMIT}টি এন্ট্রি</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => window.print()} disabled={!rows.length}>
            <Printer size={16} className="mr-1 inline" /> প্রিন্ট
          </Button>
          <Link
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            to={`${adminBase}/accounts/transactions?type=${type}`}
          >
            সব দেখুন
          </Link>
        </div>
      </div>

      <div className="print-area">
        {loading ? (
          <div className="p-4">
            <SkeletonList items={4} />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">কোনো এন্ট্রি পাওয়া যায়নি</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">নং</th>
                  <th className="px-4 py-3">নাম</th>
                  <th className="px-4 py-3">খাত</th>
                  <th className="px-4 py-3">পরিমাণ</th>
                  <th className="px-4 py-3">মাধ্যম</th>
                  <th className="px-4 py-3 text-right no-print">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {toDateInput(row.entryDate)}{" "}
                      <span className="text-slate-400 dark:text-slate-500">{toTimeInput(row.entryTime)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {(isIncome ? row.receiptNo : row.voucherNo) || "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{partyName(row)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.category}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        isIncome ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {money(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.paymentMethod}</td>
                    <td className="px-4 py-3 no-print">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintingRow(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                          title={isIncome ? "রশিদ প্রিন্ট" : "ভাউচার প্রিন্ট"}
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRow(row)}
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

      <AccountEditModal row={editingRow} onClose={() => setEditingRow(null)} onSaved={load} />
      <AccountReceiptModal row={printingRow} onClose={() => setPrintingRow(null)} />
    </Card>
  );
}
