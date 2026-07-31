import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import EmptyState from "../../components/ui/EmptyState";

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "উপস্থিত",
  ABSENT: "অনুপস্থিত",
  LATE: "বিলম্বে",
  LEAVE: "ছুটি",
};

export default function GuardianAttendancePage() {
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    (async () => {
      const res = await guardianApi.get(`/guardian/students/${selectedStudentId}/attendance`);
      setData(res.data?.data);
      setLoading(false);
    })();
  }, [selectedStudentId]);

  if (!selectedStudentId) {
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" />;
  }

  const summary = data?.summary;
  const recent = data?.recent || [];

  return (
    <div className="space-y-6">
      <PageHeader title="হাজিরা" subtitle="এই মাসের হাজিরার সারাংশ ও সাম্প্রতিক রেকর্ড" />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="উপস্থিত" value={summary?.PRESENT ?? 0} tone="emerald" loading={loading} />
        <StatTile label="অনুপস্থিত" value={summary?.ABSENT ?? 0} tone="rose" loading={loading} />
        <StatTile label="বিলম্বে" value={summary?.LATE ?? 0} tone="amber" loading={loading} />
        <StatTile label="হাজিরার হার" value={summary?.percentage ?? 0} variant="percentage" tone="blue" loading={loading} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">সাম্প্রতিক রেকর্ড</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">তারিখ</th>
                <th className="px-5 py-3">অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                    কোনো রেকর্ড নেই
                  </td>
                </tr>
              )}
              {recent.map((row: any) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-3">{new Date(row.date).toLocaleDateString("bn-BD")}</td>
                  <td className="px-5 py-3">{STATUS_LABEL[row.status] || row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
