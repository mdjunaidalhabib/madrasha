import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

export default function GuardianResultsPage() {
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    (async () => {
      const res = await guardianApi.get(`/guardian/students/${selectedStudentId}/results`);
      setResults(res.data?.data || []);
      setLoading(false);
    })();
  }, [selectedStudentId]);

  if (!selectedStudentId) {
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ফলাফল" subtitle="প্রকাশিত পরীক্ষার ফলাফল" />

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">পরীক্ষা</th>
                <th className="px-5 py-3">শ্রেণি</th>
                <th className="px-5 py-3">মোট নম্বর</th>
                <th className="px-5 py-3">গড়</th>
                <th className="px-5 py-3">গ্রেড</th>
                <th className="px-5 py-3">মেধাক্রম</th>
              </tr>
            </thead>
            <tbody>
              {!loading && results.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    এখনো কোনো ফলাফল প্রকাশিত হয়নি
                  </td>
                </tr>
              )}
              {results.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-5 py-3">{row.examName}</td>
                  <td className="px-5 py-3">{row.className}</td>
                  <td className="px-5 py-3">{row.total}</td>
                  <td className="px-5 py-3">{row.average}</td>
                  <td className="px-5 py-3">{row.generalGrade || row.madrasaGrade || "-"}</td>
                  <td className="px-5 py-3">{row.rankNo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
