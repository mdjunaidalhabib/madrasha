import { useCallback, useEffect, useState } from "react";
import {
  formatDate,
  formatNumber,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import ConfirmModal from "@madrasha/shared-ui/src/components/ui/ConfirmModal";
import {
  cancelSubscription,
  getSubscription,
  type SubscriptionSnapshot,
} from "../../../services/subscriptionApi";
import { planToolsText } from "./plan-tools.text";

export default function MadrasaSubscriptionCard({
  madrasaId,
  initial,
  onChanged,
  onBusyChange,
}: {
  madrasaId: number;
  initial?: SubscriptionSnapshot;
  onChanged?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useText(planToolsText);
  const lang = useLang();
  const show = useToastStore((state) => state.show);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await getSubscription(madrasaId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [madrasaId]);
  useEffect(() => {
    if (initial) setData(initial);
    else void load();
  }, [initial, load]);
  const money = (amount: number | null) =>
    amount == null ? t.customPrice : `৳${formatNumber(amount, lang)}`;
  const date = (value: string | null) =>
    value ? formatDate(value, lang) : "—";
  async function refund() {
    if (!data?.subscription_id || busy) return;
    setBusy(true);
    try {
      await cancelSubscription(madrasaId, data.subscription_id);
      setConfirm(false);
      show(t.refunded, "success");
      await load();
      onChanged?.();
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      show(message || t.failed, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          {t.subscription}
        </h3>
        <button
          type="button"
          disabled={loading || busy}
          className="rounded border px-3 py-1 text-xs dark:border-slate-600 dark:text-slate-200"
          onClick={() => void load()}
        >
          {t.refresh}
        </button>
      </div>
      {loading ? (
        <p role="status">{t.loading}</p>
      ) : failed ? (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {t.failed}{" "}
          <button
            type="button"
            onClick={() => void load()}
            className="underline"
          >
            {t.retry}
          </button>
        </p>
      ) : !data?.plan_name ? (
        <p className="text-sm text-slate-500">{t.noSubscription}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-semibold dark:text-slate-100">
                {lang === "bn"
                  ? data.plan_name_bn || data.plan_name
                  : data.plan_name}
              </p>
              <p className="text-xs text-slate-500">
                {data.cycle === "RENEWAL" ? t.renewalCycle : t.firstCycle}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs ${data.plan_status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}
            >
              {data.days_since_expiry != null
                ? t.expired
                : data.plan_status === "active"
                  ? t.active
                  : t.suspended}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm dark:text-slate-100">
            {[
              [t.start, date(data.start_date)],
              [t.end, date(data.end_date)],
              [t.paid, money(data.price_paid)],
              [t.nextRenewal, money(data.next_renewal_price)],
              [
                t.usage,
                `${formatNumber(data.usage.students, lang)} / ${formatNumber(data.student_limit, lang)}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  {label}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {data.over_limit && (
            <div className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <p>
                {t.extra}: {money(data.over_limit.extra_charge)} (
                {formatNumber(data.over_limit.extra_students, lang)})
              </p>
              {data.over_limit.upgrade_to && (
                <p>
                  {t.upgrade}: {data.over_limit.upgrade_to.plan_name} ·{" "}
                  {money(data.over_limit.upgrade_to.charge)}
                </p>
              )}
              <p className="font-semibold">
                {t.recommendation}:{" "}
                {data.over_limit.recommended === "UPGRADE"
                  ? t.upgradePlan
                  : t.payExtra}
              </p>
            </div>
          )}
          {data.plan_status !== "active" && (
            <p className="rounded-xl border border-amber-200 p-3 text-sm text-amber-900 dark:border-amber-900 dark:text-amber-200">
              {data.retention_notice}
            </p>
          )}
          {data.custom_domain && (
            <p
              className={`rounded-lg p-3 text-sm ${data.custom_domain.is_active ? "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}
            >
              {data.custom_domain.domain} · {date(data.custom_domain.end_date)}{" "}
              · {data.custom_domain.is_active ? t.active : t.domainExpired}
            </p>
          )}
          <div>
            <h4 className="mb-2 text-sm font-semibold dark:text-slate-100">
              {t.payments}
            </h4>
            {data.payments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs dark:text-slate-200">
                  <thead>
                    <tr>
                      {[t.date, t.amount, t.method, t.status].map((label) => (
                        <th key={label} className="p-2 text-start font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((payment, i) => (
                      <tr
                        key={`${payment.date}:${i}`}
                        className="border-t dark:border-slate-700"
                      >
                        <td className="whitespace-nowrap p-2">
                          {date(payment.date)}
                        </td>
                        <td className="p-2 tabular-nums">
                          {money(payment.amount)}
                        </td>
                        <td className="p-2">
                          {payment.method === "manual"
                            ? t.manual
                            : payment.method || "\u2014"}
                        </td>
                        <td className="p-2">
                          {payment.status === "paid"
                            ? t.paymentPaid
                            : payment.status === "pending"
                              ? t.paymentPending
                              : payment.status === "failed"
                                ? t.paymentFailed
                                : payment.status || "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t.noPayments}</p>
            )}
          </div>
          <div className="border-t pt-3 dark:border-slate-700">
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              {t.refundHint}
            </p>
            <button
              type="button"
              disabled={
                !data.refund.eligible ||
                !data.subscription_id ||
                data.refund.amount == null ||
                busy
              }
              onClick={() => setConfirm(true)}
              className="rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-800 dark:text-rose-300"
            >
              {t.refund}
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={confirm}
        title={t.refund}
        message={t.refundConfirm(formatNumber(data?.refund.amount ?? 0, lang))}
        confirmText={t.refund}
        danger
        loading={busy}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        onConfirm={() => void refund()}
      />
    </section>
  );
}
