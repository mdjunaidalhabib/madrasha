import { useEffect, useState } from "react";
import { SkeletonCard, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { getBillingReport, type BillingChannel, type BillingReport } from "../../../services/superAdminBillingApi";
import { StatCard, fmtMoney, fmtInt } from "./billingHelpers";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

export default function SuperAdminBillingReportsPage() {
  const { show } = useToastStore();
  const t = useText(billingText);

  const [channel, setChannel] = useState<BillingChannel>("SMS");
  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getBillingReport(channel);
      setReport((res?.data || null) as BillingReport | null);
    } catch (e: any) {
      show(e?.response?.data?.message || t.loadFailed, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const creditUnit = channel === "SMS" ? t.unitSms : t.unitEmails;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold dark:text-slate-100">{t.reportsTitle}</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">{t.reportsSubtitle}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setChannel("SMS")}
            className={[
              "flex-1 rounded-xl px-4 py-2 text-sm font-medium sm:flex-none",
              channel === "SMS"
                ? "bg-black text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            SMS
          </button>
          <button
            onClick={() => setChannel("EMAIL")}
            className={[
              "flex-1 rounded-xl px-4 py-2 text-sm font-medium sm:flex-none",
              channel === "EMAIL"
                ? "bg-black text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            Email
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
      )}

      {!loading && report && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t.totalSold(creditUnit)} value={fmtInt(report.totalSold)} />
            <StatCard label={t.totalUsed(creditUnit)} value={fmtInt(report.totalUsed)} />
            <StatCard label={t.totalRemaining(creditUnit)} value={fmtInt(report.totalRemaining)} />
            <StatCard label={t.activeSubscriptions} value={fmtInt(report.activeSubscriptions)} />

            <StatCard label={t.revenue} value={`৳ ${fmtMoney(report.revenue)}`} />
            <StatCard label={t.providerCostTotal} value={`৳ ${fmtMoney(report.providerCostTotal)}`} />
            <StatCard
              label={t.profit}
              value={`৳ ${fmtMoney(report.profit)}`}
              hint={Number(report.profit) < 0 ? t.loss : undefined}
            />
            <StatCard label={t.expiredSubscriptions} value={fmtInt(report.expiredCount)} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t.today}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.requests}</div>
                  {fmtInt(report.today.count)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.creditUsed}</div>
                  {fmtInt(report.today.credit)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.cost}</div>৳ {fmtMoney(report.today.cost)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t.thisMonth}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.requests}</div>
                  {fmtInt(report.month.count)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.creditUsed}</div>
                  {fmtInt(report.month.credit)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{t.cost}</div>৳ {fmtMoney(report.month.cost)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t.lowCreditTitle}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t.lowCreditSubtitle}
            </p>

            <div className="mt-3 overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="min-w-full text-start text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">{t.colInstitution}</th>
                      <th className="px-4 py-3">{t.colSlug}</th>
                      <th className="px-4 py-3">{t.remainingCredit}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {report.lowCreditMadrasas.map((m) => (
                      <tr key={m.madrasaId} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{m.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{m.slug}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{fmtInt(m.remainingCredit)}</td>
                      </tr>
                    ))}

                    {report.lowCreditMadrasas.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
                          {t.noLowCredit}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !report && (
        <div className="mt-5">
          <SkeletonTable rows={4} columns={3} />
        </div>
      )}
    </div>
  );
}
