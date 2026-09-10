import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";

export default function GuardianDashboardPage() {
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
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" hint="এই লগইনের সাথে কোনো শিক্ষার্থী যুক্ত পাওয়া যায়নি।" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={child ? child.nameBn : "ড্যাশবোর্ড"}
        subtitle={child ? `${child.className || ""} · রোল ${child.roll ?? "-"}` : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="এই মাসের হাজিরা %"
          value={loading ? "" : data?.attendance?.summary?.percentage ?? 0}
          variant="percentage"
          tone="emerald"
          loading={loading}
          to={`${base}/attendance`}
        />
        <StatTile
          label="প্রকাশিত ফলাফল"
          value={loading ? "" : (data?.results?.length ?? 0)}
          tone="indigo"
          loading={loading}
          to={`${base}/results`}
        />
        <StatTile
          label="আসন্ন পরীক্ষা"
          value={loading ? "" : (data?.upcomingExamsCount ?? 0)}
          tone="amber"
          loading={loading}
          to={`${base}/exam-routine`}
        />
        <StatTile
          label="বকেয়া ফি"
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
