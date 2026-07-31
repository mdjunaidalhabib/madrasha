import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import EmptyState from "../../components/ui/EmptyState";

export default function GuardianDashboardPage() {
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const children = useGuardianAuthStore((s) => s.children);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const child = children.find((c) => c.id === selectedStudentId);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    setData(null);
    (async () => {
      const [attendanceRes, resultsRes, feesRes] = await Promise.all([
        guardianApi.get(`/guardian/students/${selectedStudentId}/attendance`),
        guardianApi.get(`/guardian/students/${selectedStudentId}/results`),
        guardianApi.get(`/guardian/students/${selectedStudentId}/fees`),
      ]);
      setData({
        attendance: attendanceRes.data?.data,
        results: resultsRes.data?.data || [],
        fees: feesRes.data?.data,
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="এই মাসের হাজিরা %"
          value={loading ? "" : data?.attendance?.summary?.percentage ?? 0}
          variant="percentage"
          tone="emerald"
          loading={loading}
        />
        <StatTile
          label="প্রকাশিত ফলাফল"
          value={loading ? "" : (data?.results?.length ?? 0)}
          tone="indigo"
          loading={loading}
        />
        <StatTile
          label="বকেয়া ফি"
          value={loading ? "" : (data?.fees?.summary?.totalDue ?? 0)}
          variant="currency"
          tone="rose"
          loading={loading}
        />
      </div>
    </div>
  );
}
