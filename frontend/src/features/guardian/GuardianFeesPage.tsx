import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import EmptyState from "../../components/ui/EmptyState";

const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

const STATUS_LABEL: Record<string, string> = {
  UNPAID: "বকেয়া",
  PARTIALLY_PAID: "আংশিক পরিশোধিত",
  PAID: "পরিশোধিত",
  OVERDUE: "মেয়াদোত্তীর্ণ",
};

export default function GuardianFeesPage() {
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
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" />;
  }

  const invoices = data?.invoices || [];

  return (
    <div className="space-y-6">
      <PageHeader title="ফি" subtitle="ইনভয়েস ও বকেয়ার অবস্থা" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="মোট বিল" value={data?.summary?.totalBilled ?? 0} variant="currency" tone="slate" loading={loading} />
        <StatTile label="পরিশোধিত" value={data?.summary?.totalPaid ?? 0} variant="currency" tone="emerald" loading={loading} />
        <StatTile label="বকেয়া" value={data?.summary?.totalDue ?? 0} variant="currency" tone="rose" loading={loading} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">খাত</th>
                <th className="px-5 py-3">নির্ধারিত তারিখ</th>
                <th className="px-5 py-3">পরিমাণ</th>
                <th className="px-5 py-3">পরিশোধিত</th>
                <th className="px-5 py-3">অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    কোনো ইনভয়েস নেই
                  </td>
                </tr>
              )}
              {invoices.map((invoice: any) => (
                <tr key={invoice.id} className="border-t">
                  <td className="px-5 py-3">{invoice.title}</td>
                  <td className="px-5 py-3">{new Date(invoice.dueDate).toLocaleDateString("bn-BD")}</td>
                  <td className="px-5 py-3">{money(invoice.amount)}</td>
                  <td className="px-5 py-3">{money(invoice.paidAmount)}</td>
                  <td className="px-5 py-3">{STATUS_LABEL[invoice.status] || invoice.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
