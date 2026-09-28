import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { formatDate, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

export default function GuardianAttendancePage() {
  const t = useText(guardianText);
  const lang = useLang();
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
    return <EmptyState title={t.noChild} />;
  }

  const summary = data?.summary;
  const recent = data?.recent || [];

  return (
    <div className="space-y-6">
      <PageHeader title={t.attendance} subtitle={t.attendanceSubtitle} />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label={t.attendanceStatus.PRESENT} value={summary?.PRESENT ?? 0} tone="emerald" loading={loading} />
        <StatTile label={t.attendanceStatus.ABSENT} value={summary?.ABSENT ?? 0} tone="rose" loading={loading} />
        <StatTile label={t.attendanceStatus.LATE} value={summary?.LATE ?? 0} tone="amber" loading={loading} />
        <StatTile label={t.attendanceRate} value={summary?.percentage ?? 0} variant="percentage" tone="blue" loading={loading} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{t.recentRecords}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-slate-50 text-start text-slate-500">
              <tr>
                <th className="px-5 py-3">{t.date}</th>
                <th className="px-5 py-3">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                    {t.noRecords}
                  </td>
                </tr>
              )}
              {recent.map((row: any) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-3">{formatDate(row.date, lang)}</td>
                  <td className="px-5 py-3">{t.attendanceStatus[row.status] || row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
