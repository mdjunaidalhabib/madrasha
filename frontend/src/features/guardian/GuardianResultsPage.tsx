import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import TableSkeleton from "@madrasha/shared-ui/src/components/ui/TableSkeleton";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

export default function GuardianResultsPage() {
  const t = useText(guardianText);
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);
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
    return <EmptyState title={t.noChild} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.results} subtitle={t.resultsSubtitle} />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : results.length === 0 ? (
        <EmptyState title={t.noResults} hint={t.noResultsHint} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-start text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t.exam}</th>
                  <th className="px-5 py-3">{t.class}</th>
                  <th className="px-5 py-3">{t.totalMarks}</th>
                  <th className="px-5 py-3">{t.average}</th>
                  <th className="px-5 py-3">{t.grade}</th>
                  <th className="px-5 py-3">{t.rank}</th>
                  <th className="px-5 py-3">{t.marksheet}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-5 py-3">{row.examName}</td>
                    <td className="px-5 py-3">{row.className}</td>
                    <td className="px-5 py-3">{row.total}</td>
                    <td className="px-5 py-3">{row.average}</td>
                    <td className="px-5 py-3">{row.generalGrade || row.madrasaGrade || "-"}</td>
                    <td className="px-5 py-3">{row.rankNo ?? "-"}</td>
                    <td className="px-5 py-3">
                      <Link
                        to={`${base}/results/${row.resultMasterId}`}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {t.viewMarksheet}
                      </Link>
                    </td>
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
