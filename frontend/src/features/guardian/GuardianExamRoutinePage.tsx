import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import TableSkeleton from "@madrasha/shared-ui/src/components/ui/TableSkeleton";

const formatExamDate = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("bn-BD", { day: "2-digit", month: "long", year: "numeric" });
};

export default function GuardianExamRoutinePage() {
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const [routine, setRoutine] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    (async () => {
      const res = await guardianApi.get(`/guardian/students/${selectedStudentId}/exam-routine`);
      setRoutine(res.data?.data || []);
      setLoading(false);
    })();
  }, [selectedStudentId]);

  if (!selectedStudentId) {
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="পরীক্ষার সময়সূচি" subtitle="সন্তানের শ্রেণির আসন্ন ও চলমান পরীক্ষার সময়সূচি" />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : routine.length === 0 ? (
        <EmptyState title="কোনো পরীক্ষার সময়সূচি পাওয়া যায়নি" hint="সময়সূচি প্রকাশিত হলে এখানে দেখা যাবে।" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3">পরীক্ষা</th>
                  <th className="px-5 py-3">বিষয়</th>
                  <th className="px-5 py-3">তারিখ</th>
                  <th className="px-5 py-3">সময়</th>
                  <th className="px-5 py-3">কক্ষ নম্বর</th>
                </tr>
              </thead>
              <tbody>
                {routine.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-5 py-3">
                      {row.examName} {row.examYear ? `- ${row.examYear}` : ""}
                    </td>
                    <td className="px-5 py-3">{row.subject}</td>
                    <td className="px-5 py-3">{formatExamDate(row.examDate)}</td>
                    <td className="px-5 py-3">
                      {row.startTime} - {row.endTime}
                    </td>
                    <td className="px-5 py-3">{row.roomNo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
