import { useEffect, useState } from "react";
import {
  billingApi,
  type BillingChannel,
  type BillingTransaction,
  type BillingTransactionType,
  type MessageUsageLog,
  type MessageUsageStatus,
} from "../../services/billingApi";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useLang, useText, formatNumber, formatDateTime } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

type HistoryMode = "transactions" | "usage";


const USAGE_STATUS_CLASSES: Record<MessageUsageStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const BillingHistoryTables = () => {
  const tx = useText(billingText);
  const lang = useLang();
  const CHANNEL_OPTIONS: { value: BillingChannel | ""; label: string }[] = [
    { value: "", label: tx.allChannels },
    { value: "SMS", label: "SMS" },
    { value: "EMAIL", label: tx.email },
  ];
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
            {tx.transactions}
          </button>
          <button
            type="button"
            onClick={() => setMode("usage")}
            className={`h-8 rounded-md px-3 text-xs font-medium transition ${
              mode === "usage" ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {tx.usageHistory}
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
          <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">{tx.noTransactions}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((t) => (
              <div key={t.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-slate-200">
                    {t.channel === "SMS" ? "SMS" : tx.email} — {tx.txType[t.type as BillingTransactionType]}
                    {t.package?.name ? ` (${t.package.name})` : ""}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      t.creditDelta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {t.creditDelta >= 0 ? "+" : ""}
                    {formatNumber(t.creditDelta, lang)} {tx.credit}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {tx.balance}: {formatNumber(t.balanceAfter, lang)}
                  {t.amount && ` · ৳${formatNumber(Number(t.amount), lang)}`} ·{" "}
                  {formatDateTime(t.createdAt, lang)}
                </p>
                {t.note && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t.note}</p>}
              </div>
            ))}
          </div>
        )
      ) : usage.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">{tx.noUsage}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {usage.map((u) => (
            <div key={u.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-slate-200">
                  {u.channel === "SMS" ? "SMS" : tx.email} → {u.recipient}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs ${USAGE_STATUS_CLASSES[u.status]}`}>
                  {tx.usageStatus[u.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {formatNumber(u.creditUsed, lang)} {tx.creditUsed}
                {u.segmentCount ? ` · ${formatNumber(u.segmentCount, lang)} ${tx.segments}` : ""}
                {u.totalCost && ` · ৳${formatNumber(Number(u.totalCost), lang)}`} ·{" "}
                {formatDateTime(u.createdAt, lang)}
              </p>
              {u.failureReason && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{tx.error}: {u.failureReason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillingHistoryTables;
