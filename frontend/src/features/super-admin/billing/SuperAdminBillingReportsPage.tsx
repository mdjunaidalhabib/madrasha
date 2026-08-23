import { useEffect, useState } from "react";
import { SkeletonCard, SkeletonTable } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import { getBillingReport, type BillingChannel, type BillingReport } from "../../../services/superAdminBillingApi";
import { StatCard, fmtMoney, fmtInt } from "./billingHelpers";

export default function SuperAdminBillingReportsPage() {
  const { show } = useToastStore();

  const [channel, setChannel] = useState<BillingChannel>("SMS");
  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getBillingReport(channel);
      setReport((res?.data || null) as BillingReport | null);
    } catch (e: any) {
      show(e?.response?.data?.message || "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const creditUnit = channel === "SMS" ? "SMS" : "Emails";

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold dark:text-slate-100">Billing Reports</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">Revenue, cost ও profit এর সারসংক্ষেপ।</p>
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
            <StatCard label={`Total Sold (${creditUnit})`} value={fmtInt(report.totalSold)} />
            <StatCard label={`Total Used (${creditUnit})`} value={fmtInt(report.totalUsed)} />
            <StatCard label={`Total Remaining (${creditUnit})`} value={fmtInt(report.totalRemaining)} />
            <StatCard label="Active Subscriptions" value={fmtInt(report.activeSubscriptions)} />

            <StatCard label="Revenue" value={`৳ ${fmtMoney(report.revenue)}`} />
            <StatCard label="Provider Cost" value={`৳ ${fmtMoney(report.providerCostTotal)}`} />
            <StatCard
              label="Profit"
              value={`৳ ${fmtMoney(report.profit)}`}
              hint={Number(report.profit) < 0 ? "লোকসান" : undefined}
            />
            <StatCard label="Expired Subscriptions" value={fmtInt(report.expiredCount)} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Today</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Requests</div>
                  {fmtInt(report.today.count)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Credit Used</div>
                  {fmtInt(report.today.credit)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Cost</div>৳ {fmtMoney(report.today.cost)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">This Month</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Requests</div>
                  {fmtInt(report.month.count)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Credit Used</div>
                  {fmtInt(report.month.credit)}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Cost</div>৳ {fmtMoney(report.month.cost)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Low Credit Madrasas</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              যেসব মাদরাসার remaining credit threshold এর নিচে নেমে গেছে।
            </p>

            <div className="mt-3 overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Madrasa</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Remaining Credit</th>
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
                          কোনো low-credit মাদরাসা নেই
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
