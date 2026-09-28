import { useEffect, useState } from "react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import TableSkeleton from "@madrasha/shared-ui/src/components/ui/TableSkeleton";
import { formatDate, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

const formatExamDate = (value: unknown, lang: Lang) => {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return formatDate(date, lang, { day: "2-digit", month: "long", year: "numeric" });
};

export default function GuardianExamRoutinePage() {
  const t = useText(guardianText);
  const lang = useLang();
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
    return <EmptyState title={t.noChild} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.examRoutine} subtitle={t.examRoutineSubtitle} />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : routine.length === 0 ? (
        <EmptyState title={t.noRoutine} hint={t.noRoutineHint} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-start text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t.exam}</th>
                  <th className="px-5 py-3">{t.subject}</th>
                  <th className="px-5 py-3">{t.date}</th>
                  <th className="px-5 py-3">{t.time}</th>
                  <th className="px-5 py-3">{t.roomNo}</th>
                </tr>
              </thead>
              <tbody>
                {routine.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-5 py-3">
                      {row.examName} {row.examYear ? `- ${row.examYear}` : ""}
                    </td>
                    <td className="px-5 py-3">{row.subject}</td>
                    <td className="px-5 py-3">{formatExamDate(row.examDate, lang)}</td>
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
