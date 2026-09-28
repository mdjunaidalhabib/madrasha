import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

export default function GuardianDashboardPage() {
  const t = useText(guardianText);
  const lang = useLang();
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const children = useGuardianAuthStore((s) => s.children);
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const child = children.find((c) => c.id === selectedStudentId);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    setData(null);
    (async () => {
      const [attendanceRes, resultsRes, feesRes, examRoutineRes] = await Promise.all([
        guardianApi.get(`/guardian/students/${selectedStudentId}/attendance`),
        guardianApi.get(`/guardian/students/${selectedStudentId}/results`),
        guardianApi.get(`/guardian/students/${selectedStudentId}/fees`),
        guardianApi.get(`/guardian/students/${selectedStudentId}/exam-routine`),
      ]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingExams = (examRoutineRes.data?.data || []).filter((row: any) => {
        const examDate = new Date(row.examDate);
        return !Number.isNaN(examDate.getTime()) && examDate >= today;
      });
      setData({
        attendance: attendanceRes.data?.data,
        results: resultsRes.data?.data || [],
        fees: feesRes.data?.data,
        upcomingExamsCount: upcomingExams.length,
      });
      setLoading(false);
    })();
  }, [selectedStudentId]);

  if (!selectedStudentId) {
    return <EmptyState title={t.noChild} hint={t.noChildHint} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={child ? child.nameBn : t.dashboard}
        subtitle={child ? `${child.className || ""} · ${t.roll} ${localizeDigits(child.roll ?? "-", lang)}` : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t.monthAttendancePct}
          value={loading ? "" : data?.attendance?.summary?.percentage ?? 0}
          variant="percentage"
          tone="emerald"
          loading={loading}
          to={`${base}/attendance`}
        />
        <StatTile
          label={t.publishedResults}
          value={loading ? "" : (data?.results?.length ?? 0)}
          tone="indigo"
          loading={loading}
          to={`${base}/results`}
        />
        <StatTile
          label={t.upcomingExams}
          value={loading ? "" : (data?.upcomingExamsCount ?? 0)}
          tone="amber"
          loading={loading}
          to={`${base}/exam-routine`}
        />
        <StatTile
          label={t.dueFees}
          value={loading ? "" : (data?.fees?.summary?.totalDue ?? 0)}
          variant="currency"
          tone="rose"
          loading={loading}
          to={`${base}/fees`}
        />
      </div>
    </div>
  );
}
