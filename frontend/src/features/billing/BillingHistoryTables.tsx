import { useEffect, useState } from "react";
import {
  billingApi,
  type BillingChannel,
  type BillingTransaction,
  type BillingTransactionType,
  type MessageUsageLog,
  type MessageUsageStatus,
} from "../../services/billingApi";
import { SkeletonList } from "../../components/ui/Skeleton";
import { logger } from "../../utils/logger";

type HistoryMode = "transactions" | "usage";

const TRANSACTION_TYPE_LABELS: Record<BillingTransactionType, string> = {
  PACKAGE_PURCHASE: "প্যাকেজ ক্রয়",
  RECHARGE: "রিচার্জ",
  RENEWAL: "নবায়ন",
  USAGE: "ব্যবহার",
  REFUND: "ফেরত",
  MANUAL_CREDIT: "ম্যানুয়াল ক্রেডিট",
  MANUAL_DEDUCTION: "ম্যানুয়াল কর্তন",
};

const USAGE_STATUS_LABELS: Record<MessageUsageStatus, { label: string; className: string }> = {
  PENDING: { label: "প্রক্রিয়াধীন", className: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400" },
  SENT: { label: "পাঠানো হয়েছে", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  DELIVERED: { label: "ডেলিভার হয়েছে", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  FAILED: { label: "ব্যর্থ", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  REJECTED: { label: "বাতিল", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
};

const CHANNEL_OPTIONS: { value: BillingChannel | ""; label: string }[] = [
  { value: "", label: "সব চ্যানেল" },
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "ইমেইল" },
];

const BillingHistoryTables = () => {
  const [mode, setMode] = useState<HistoryMode>("transactions");
  const [channel, setChannel] = useState<BillingChannel | "">("");
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [usage, setUsage] = useState<MessageUsageLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = { channel: channel || undefined, limit: 50 };
    if (mode === "transactions") {
      billingApi
        .getTransactions(params)
        .then((res) => setTransactions(res.data.data || []))
        .catch((err) => {
          logger.error("LOAD BILLING TRANSACTIONS ERROR:", err);
          setTransactions([]);
        })
        .finally(() => setLoading(false));
    } else {
      billingApi
        .getUsage(params)
        .then((res) => setUsage(res.data.data || []))
        .catch((err) => {
          logger.error("LOAD BILLING USAGE ERROR:", err);
          setUsage([]);
        })
        .finally(() => setLoading(false));
    }
  }, [mode, channel]);

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("transactions")}
            className={`h-8 rounded-md px-3 text-xs font-medium transition ${
              mode === "transactions" ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            লেনদেন
          </button>
          <button
            type="button"
            onClick={() => setMode("usage")}
            className={`h-8 rounded-md px-3 text-xs font-medium transition ${
              mode === "usage" ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            ব্যবহারের ইতিহাস
          </button>
        </div>

        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as BillingChannel | "")}
          className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonList items={5} />
      ) : mode === "transactions" ? (
        transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">কোনো লেনদেন নেই</div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((t) => (
              <div key={t.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-slate-200">
                    {t.channel === "SMS" ? "SMS" : "ইমেইল"} — {TRANSACTION_TYPE_LABELS[t.type]}
                    {t.package?.name ? ` (${t.package.name})` : ""}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      t.creditDelta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {t.creditDelta >= 0 ? "+" : ""}
                    {t.creditDelta.toLocaleString("bn-BD")} ক্রেডিট
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  ব্যালেন্স: {t.balanceAfter.toLocaleString("bn-BD")}
                  {t.amount && ` · ৳${Number(t.amount).toLocaleString("bn-BD")}`} ·{" "}
                  {new Date(t.createdAt).toLocaleString("bn-BD")}
                </p>
                {t.note && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t.note}</p>}
              </div>
            ))}
          </div>
        )
      ) : usage.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">কোনো ব্যবহার নেই</div>
      ) : (
        <div className="flex flex-col gap-2">
          {usage.map((u) => (
            <div key={u.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-slate-200">
                  {u.channel === "SMS" ? "SMS" : "ইমেইল"} → {u.recipient}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs ${USAGE_STATUS_LABELS[u.status].className}`}>
                  {USAGE_STATUS_LABELS[u.status].label}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {u.creditUsed.toLocaleString("bn-BD")} ক্রেডিট ব্যবহৃত
                {u.segmentCount ? ` · ${u.segmentCount} সেগমেন্ট` : ""}
                {u.totalCost && ` · ৳${Number(u.totalCost).toLocaleString("bn-BD")}`} ·{" "}
                {new Date(u.createdAt).toLocaleString("bn-BD")}
              </p>
              {u.failureReason && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">ত্রুটি: {u.failureReason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillingHistoryTables;
