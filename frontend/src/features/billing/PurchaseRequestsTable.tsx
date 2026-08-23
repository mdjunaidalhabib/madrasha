import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { billingApi, type MessagePurchaseRequest, type PurchaseRequestStatus } from "../../services/billingApi";
import { SkeletonList } from "../../components/ui/Skeleton";
import { logger } from "../../utils/logger";

const STATUS_LABELS: Record<PurchaseRequestStatus, { label: string; className: string }> = {
  PENDING: { label: "অপেক্ষমাণ", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  APPROVED: { label: "অনুমোদিত", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  REJECTED: { label: "বাতিল", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
};

export interface PurchaseRequestsTableHandle {
  reload: () => void;
}

const PurchaseRequestsTable = forwardRef<PurchaseRequestsTableHandle>((_props, ref) => {
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
    return <div className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">কোনো অনুরোধ নেই</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => (
        <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-800 dark:text-slate-200">
              {r.channel === "SMS" ? "SMS" : "ইমেইল"} — {r.package?.name || "প্যাকেজ"}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_LABELS[r.status].className}`}>
              {STATUS_LABELS[r.status].label}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            ৳{Number(r.amount).toLocaleString("bn-BD")}
            {r.paymentMethodLabel && ` · ${r.paymentMethodLabel}`}
            {r.transactionRef && ` · ${r.transactionRef}`} ·{" "}
            {new Date(r.createdAt).toLocaleString("bn-BD")}
          </p>
          {r.note && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">নোট: {r.note}</p>}
          {r.status !== "PENDING" && r.reviewNote && (
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
              পর্যালোচনা: {r.reviewNote}
            </p>
          )}
        </div>
      ))}
    </div>
  );
});

PurchaseRequestsTable.displayName = "PurchaseRequestsTable";

export default PurchaseRequestsTable;
