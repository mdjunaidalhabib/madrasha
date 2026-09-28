import { useEffect, useMemo, useState } from "react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { SkeletonList, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  listPurchaseRequests,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from "../../../services/superAdminBillingApi";
import { StatusBadge, IconButton, fmtMoney } from "./billingHelpers";
import { commonText, formatDate, formatDateTime, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

type StatusFilter = PurchaseRequestStatus | "all";

export default function SuperAdminBillingRequestsPage() {
  const { show } = useToastStore();
  const t = useText(billingText);
  const c = useText(commonText);
  const lang = useLang();

  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [rows, setRows] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [reviewTarget, setReviewTarget] = useState<PurchaseRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listPurchaseRequests(status === "all" ? undefined : { status });
      setRows((res?.data || []) as PurchaseRequest[]);
    } catch (e: any) {
      show(e?.response?.data?.message || t.loadFailed, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function openReview(mode: "approve" | "reject", req: PurchaseRequest) {
    setReviewMode(mode);
    setReviewTarget(req);
    setReviewNote("");
    setReviewOpen(true);
  }

  const reviewTitle = useMemo(
    () => (reviewMode === "approve" ? t.approveTitle : t.rejectTitle),
    [reviewMode, t],
  );

  async function submitReview() {
    if (!reviewTarget) return;
    setReviewLoading(true);
    try {
      if (reviewMode === "approve") {
        await approvePurchaseRequest(reviewTarget.id, reviewNote || undefined);
        show(t.requestApproved, "success");
      } else {
        await rejectPurchaseRequest(reviewTarget.id, reviewNote || undefined);
        show(t.requestRejected, "success");
      }
      setReviewOpen(false);
      setReviewTarget(null);
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || t.actionFailed, "error");
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold dark:text-slate-100">{t.requestsTitle}</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {t.requestsSubtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-gray-600 dark:text-slate-400">{t.status}</label>
          <select
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="PENDING">{t.pending}</option>
            <option value="APPROVED">{t.approved}</option>
            <option value="REJECTED">{t.rejected}</option>
            <option value="all">{t.all}</option>
          </select>
        </div>

        <div className="md:col-span-4 flex items-end gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {loading ? c.loading : t.refresh}
          </button>

          <div className="text-xs text-gray-500 dark:text-slate-400">
            {t.total}: <span className="font-medium text-gray-800 dark:text-slate-100">{rows.length}</span>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="mt-5 space-y-3 md:hidden">
        {loading && <SkeletonList items={3} />}

        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-medium text-gray-800 dark:text-slate-100">{t.noRequests}</div>
          </div>
        )}

        {!loading &&
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">{r.madrasa?.name ?? "-"}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {r.channel} — {r.package?.name ?? "-"}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.amount}</div>৳ {fmtMoney(r.amount)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.paymentMethod}</div>
                  {r.paymentMethodLabel}
                </div>
              </div>

              {r.transactionRef && (
                <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t.ref}: {r.transactionRef}</div>
              )}
              {r.note && <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t.note}: {r.note}</div>}

              <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                {t.submitted}: {formatDateTime(r.createdAt, lang)}
              </div>

              {r.status === "PENDING" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <IconButton title={t.approve} onClick={() => openReview("approve", r)}>
                    ✅ {t.approve}
                  </IconButton>
                  <IconButton title={t.reject} variant="danger" onClick={() => openReview("reject", r)}>
                    ❌ {t.reject}
                  </IconButton>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-hidden rounded-2xl border bg-white md:block">
        {loading ? (
          <SkeletonTable rows={6} columns={8} className="rounded-none" bordered={false} shadowed={false} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-start text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-4 py-3">{t.colInstitution}</th>
                  <th className="px-4 py-3">{t.colChannel}</th>
                  <th className="px-4 py-3">{t.colPackage}</th>
                  <th className="px-4 py-3">{t.amount}</th>
                  <th className="px-4 py-3">{t.colPayment}</th>
                  <th className="px-4 py-3">{t.submitted}</th>
                  <th className="px-4 py-3">{t.status}</th>
                  <th className="px-4 py-3 text-end">{t.colActions}</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.madrasa?.name ?? "-"}</div>
                      <div className="text-xs text-gray-500">{r.madrasa?.slug ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.channel}</td>
                    <td className="px-4 py-3 text-gray-700">{r.package?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-700">৳ {fmtMoney(r.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{r.paymentMethodLabel}</div>
                      {r.transactionRef && <div className="text-xs text-gray-500">{t.ref}: {r.transactionRef}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(r.createdAt, lang)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <IconButton title={t.approve} onClick={() => openReview("approve", r)}>
                            ✅ {t.approve}
                          </IconButton>
                          <IconButton title={t.reject} variant="danger" onClick={() => openReview("reject", r)}>
                            ❌ {t.reject}
                          </IconButton>
                        </div>
                      ) : (
                        <div className="text-end text-xs text-gray-400">
                          {r.reviewedAt ? formatDateTime(r.reviewedAt, lang) : ""}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="text-sm font-medium text-gray-800">{t.noRequests}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve/Reject Modal */}
      <Modal open={reviewOpen} title={reviewTitle} onClose={() => (!reviewLoading ? setReviewOpen(false) : null)}>
        <div className="space-y-4">
          <div className="rounded-xl border bg-gray-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="font-medium text-gray-900 dark:text-slate-100">{reviewTarget?.madrasa?.name}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">
              {reviewTarget?.channel} — {reviewTarget?.package?.name} — ৳ {fmtMoney(reviewTarget?.amount)}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs text-gray-600 dark:text-slate-400">{t.reviewNote}</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={reviewMode === "approve" ? t.approveNotePlaceholder : t.rejectNotePlaceholder}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              disabled={reviewLoading}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {c.cancel}
            </button>

            <button
              type="button"
              onClick={submitReview}
              disabled={reviewLoading}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60",
                reviewMode === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-black/90",
              ].join(" ")}
            >
              {reviewLoading ? t.pleaseWait : reviewMode === "approve" ? t.approve : t.reject}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
