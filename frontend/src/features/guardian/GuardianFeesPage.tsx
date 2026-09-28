import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { formatCurrency, formatDate, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

export default function GuardianFeesPage() {
  const t = useText(guardianText);
  const lang = useLang();
  const money = (value: number | string) => formatCurrency(value || 0, lang);
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    (async () => {
      const res = await guardianApi.get(`/guardian/students/${selectedStudentId}/fees`);
      setData(res.data?.data);
      setLoading(false);
    })();
  }, [selectedStudentId]);

  if (!selectedStudentId) {
    return <EmptyState title={t.noChild} />;
  }

  const invoices = data?.invoices || [];

  return (
    <div className="space-y-6">
      <PageHeader title={t.fees} subtitle={t.feesSubtitle} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t.totalBilled} value={data?.summary?.totalBilled ?? 0} variant="currency" tone="slate" loading={loading} />
        <StatTile label={t.paid} value={data?.summary?.totalPaid ?? 0} variant="currency" tone="emerald" loading={loading} />
        <StatTile label={t.due} value={data?.summary?.totalDue ?? 0} variant="currency" tone="rose" loading={loading} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-start text-slate-500">
              <tr>
                <th className="px-5 py-3">{t.feeHead}</th>
                <th className="px-5 py-3">{t.dueDate}</th>
                <th className="px-5 py-3">{t.amount}</th>
                <th className="px-5 py-3">{t.paid}</th>
                <th className="px-5 py-3">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    {t.noInvoices}
                  </td>
                </tr>
              )}
              {invoices.map((invoice: any) => (
                <tr key={invoice.id} className="border-t">
                  <td className="px-5 py-3">{invoice.title}</td>
                  <td className="px-5 py-3">{formatDate(invoice.dueDate, lang)}</td>
                  <td className="px-5 py-3">{money(invoice.amount)}</td>
                  <td className="px-5 py-3">{money(invoice.paidAmount)}</td>
                  <td className="px-5 py-3">{t.invoiceStatus[invoice.status] || invoice.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
