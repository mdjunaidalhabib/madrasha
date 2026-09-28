import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { billingApi, type MessagePurchaseRequest, type PurchaseRequestStatus } from "../../services/billingApi";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useLang, useText, formatNumber, formatDateTime } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

const STATUS_CLASSES: Record<PurchaseRequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

export interface PurchaseRequestsTableHandle {
  reload: () => void;
}

const PurchaseRequestsTable = forwardRef<PurchaseRequestsTableHandle>((_props, ref) => {
  const tx = useText(billingText);
  const lang = useLang();
  const [requests, setRequests] = useState<MessagePurchaseRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    billingApi
      .getPurchaseRequests({ limit: 50 })
      .then((res) => setRequests(res.data.data || []))
      .catch((err) => {
        logger.error("LOAD PURCHASE REQUESTS ERROR:", err);
        setRequests([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useImperativeHandle(ref, () => ({ reload: load }));

  if (loading) return <SkeletonList items={5} />;
  if (requests.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">{tx.noRequests}</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => (
        <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-800 dark:text-slate-200">
              {r.channel === "SMS" ? "SMS" : tx.email} — {r.package?.name || tx.packageBadge}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASSES[r.status]}`}>
              {tx.requestStatus[r.status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            ৳{formatNumber(Number(r.amount), lang)}
            {r.paymentMethodLabel && ` · ${r.paymentMethodLabel}`}
            {r.transactionRef && ` · ${r.transactionRef}`} ·{" "}
            {formatDateTime(r.createdAt, lang)}
          </p>
          {r.note && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{tx.note}: {r.note}</p>}
          {r.status !== "PENDING" && r.reviewNote && (
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
              {tx.review}: {r.reviewNote}
            </p>
          )}
        </div>
      ))}
    </div>
  );
});

PurchaseRequestsTable.displayName = "PurchaseRequestsTable";

export default PurchaseRequestsTable;
