import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStudentRoute } from "./studentRoute";
import api, { cachedGet } from "../../services/api";
import { useText, getText, useLang, localizeDigits, formatCurrency, formatDate } from "@madrasha/shared-ui/src/i18n";
import { profile360Text } from "./StudentProfile360.text";
import { BookOpen, CalendarCheck, GraduationCap, Wallet } from "lucide-react";
import StudentProfileHeader from "../../components/studentProfile/StudentProfileHeader";
import StudentProfileOverview from "../../components/studentProfile/StudentProfileOverview";
import { studentProfilePageClass } from "../../components/studentProfile/profileStyles";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import StudentProfileSkeleton, { StudentDetailsSkeleton } from "../../components/studentProfile/StudentProfileSkeleton";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

// Tab labels come from profile360Text.tabs.
const TABS = [
  { key: "overview", slug: "" },
  { key: "academic", slug: "academic" },
  { key: "attendance", slug: "attendance" },
  { key: "financial", slug: "fees" },
  { key: "library", slug: "library" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** URL-এর ট্যাব সেগমেন্ট → TabKey; অজানা/খালি হলে ওভারভিউ */
const tabFromSlug = (slug: string | undefined): TabKey =>
  (slug && TABS.find((t) => t.slug === slug)?.key) || "overview";


export default function StudentProfile360() {
  const { id: ref } = useParams();
  const { id, resolved } = useStudentRoute();
  const tx = useText(profile360Text);
  const lang = useLang();
  const toBanglaDigits = (v: string | number) => localizeDigits(v, lang);
  const money = (value: number | string | undefined) => formatCurrency(value || 0, lang);
  const dateBn = (value: string | Date | null | undefined) => (value ? formatDate(value, lang) : "-");
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string>();
  // ট্যাব URL-এ থাকে: /students/:id (ওভারভিউ) বা /students/:id/:tab
  const { tab: tabSlug } = useParams();
  const tab = tabFromSlug(tabSlug);
  const setTab = (key: TabKey) => {
    const slug = TABS.find((t) => t.key === key)?.slug;
    navigate(slug ? `/students/${ref}/${slug}` : `/students/${ref}`, { replace: true });
  };

  // পূর্ণাঙ্গ (বিস্তারিত) তথ্য — ছাত্র/অভিভাবক/ঠিকানার সব ফিল্ড, শুধু দেখার জন্য (রিড-অনলি)
  const [fullStudent, setFullStudent] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);

  useEffect(() => {
    let current = true;
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/students/${id}/profile-360`);
        if (current) setData(res.data?.data || null);
      } catch (error) {
        if (!current) return;
        setData(null);
        logger.error("FETCH STUDENT PROFILE 360 ERROR:", error);
        useToastStore.getState().show(getText(profile360Text).loadFailed, "error");
      } finally {
        if (current) {
          setLoadedId(id);
          setLoading(false);
        }
      }
    })();
    return () => { current = false; };
  }, [id]);

  useEffect(() => {
    let current = true;
    setFullStudent(null);
    if (!id) {
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    (async () => {
      try {
        const res = await cachedGet(`/students/${id}`);
        if (current) setFullStudent(res.data?.data || null);
      } catch (error) {
        logger.error("FETCH STUDENT FULL DETAILS ERROR:", error);
      } finally {
        if (current) setDetailsLoading(false);
      }
    })();
    return () => { current = false; };
  }, [id]);

  const student = data?.student;
  const results = data?.results || [];
  const attendanceSummary = data?.attendanceSummary;
  const feeSummary = data?.feeSummary;
  const libraryRecords = data?.libraryRecords || [];
  const promotionHistory = data?.promotionHistory || [];

  // ডকুমেন্ট রিপোর্ট পাতায় এই শিক্ষার্থীকেই আগে থেকে বেছে খোলে (বিভাগ/শ্রেণি + student_id)
  const documentsLink = (reportKey: string, examId?: number | null) => {
    const params = new URLSearchParams({ key: reportKey, student_id: String(student.id) });
    if (student.divisionId) params.set("division_id", String(student.divisionId));
    if (student.classId) params.set("class_id", String(student.classId));
    if (examId) params.set("exam_id", String(examId));
    return `/reports/documents?${params.toString()}`;
  };

  // মার্কশিট: সর্বশেষ প্রকাশিত ফলাফলের পরীক্ষা (results ইতিমধ্যে নতুন→পুরাতন সাজানো)
  const latestPublishedExamId =
    results.find((row: any) => row.resultMaster?.status === "PUBLISHED")?.resultMaster?.examId ?? null;

  if (!resolved || loading || (id && loadedId !== id)) return <StudentProfileSkeleton />;

  if (!student) {
    return (
      <div className={studentProfilePageClass}>
        <EmptyState title={tx.notFound} />
      </div>
    );
  }

  return (
    <div className={`${studentProfilePageClass} space-y-6`}>
      <StudentProfileHeader
        student={student}
        details={fullStudent}
        onEdit={() => navigate(`/students/${ref}/edit`, { state: { autoEdit: true } })}
        onPrint={() => navigate(documentsLink("student-id-cards"))}
        onMarksheet={() => navigate(documentsLink("student-marksheets", latestPublishedExamId))}
        onCollectFee={() => navigate(`/fee-collection?student_id=${student.id}`)}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tx.tabs[t.key]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: tx.attendanceRate, value: `${toBanglaDigits(attendanceSummary?.percentage ?? 0)}%`, icon: CalendarCheck, color: "text-teal-600 dark:text-teal-400" },
              { label: tx.publishedResults, value: toBanglaDigits(results.length), icon: GraduationCap, color: "text-indigo-500 dark:text-indigo-400" },
              { label: tx.dueFee, value: money(feeSummary?.totalDue), icon: Wallet, color: "text-rose-500 dark:text-rose-400" },
              { label: tx.libraryRecords, value: toBanglaDigits(libraryRecords.length), icon: BookOpen, color: "text-amber-600 dark:text-amber-400" },
            ].map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0"><p className="text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">{value}</p></div>
              <Icon size={18} strokeWidth={1.6} className={`mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
            </div>)}
          </div>
          {detailsLoading && <div role="status" aria-busy="true" aria-label={lang === "bn" ? "বিস্তারিত তথ্য লোড হচ্ছে" : "Loading student details"} className="space-y-6"><StudentDetailsSkeleton /><StudentDetailsSkeleton fields={12} /><StudentDetailsSkeleton fields={8} /><StudentDetailsSkeleton fields={4} /></div>}
          {fullStudent && <StudentProfileOverview student={fullStudent} summary={student} />}
          {!detailsLoading && !fullStudent && <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><EmptyState title={tx.detailsUnavailable} /></div>}
        </div>
      )}

      {tab === "academic" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tx.examResults}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">{tx.exam}</th>
                    <th className="px-5 py-3">{tx.class}</th>
                    <th className="px-5 py-3">{tx.state}</th>
                    <th className="px-5 py-3">{tx.totalMarks}</th>
                    <th className="px-5 py-3">{tx.average}</th>
                    <th className="px-5 py-3">{tx.grade}</th>
                    <th className="px-5 py-3">{tx.rank}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                        {tx.noResults}
                      </td>
                    </tr>
                  )}
                  {results.map((row: any, i: number) => (
                    <tr key={i} className="border-t dark:border-slate-700">
                      <td className="px-5 py-3">{row.resultMaster?.exam?.name}</td>
                      <td className="px-5 py-3">
                        {row.resultMaster?.class?.nameBn || row.resultMaster?.class?.name || "-"}
                      </td>
                      <td className="px-5 py-3">
                        {row.resultMaster?.status === "PUBLISHED" ? tx.published : tx.draft}
                      </td>
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

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tx.promotionHistory}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">{tx.session}</th>
                    <th className="px-5 py-3">{tx.rollChange}</th>
                    <th className="px-5 py-3">{tx.state}</th>
                    <th className="px-5 py-3">{tx.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        {tx.noInfo}
                      </td>
                    </tr>
                  )}
                  {promotionHistory.map((row: any) => (
                    <tr key={row.id} className="border-t dark:border-slate-700">
                      <td className="px-5 py-3">
                        {row.batch?.fromYear} → {row.batch?.toYear}
                      </td>
                      <td className="px-5 py-3">
                        {row.oldRoll} → {row.newRoll ?? "-"}
                      </td>
                      <td className="px-5 py-3">{tx.promotionStatus[row.status] || row.status}</td>
                      <td className="px-5 py-3">{dateBn(row.batch?.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label={tx.present} value={attendanceSummary?.PRESENT ?? 0} tone="emerald" />
            <StatTile label={tx.absent} value={attendanceSummary?.ABSENT ?? 0} tone="rose" />
            <StatTile label={tx.late} value={attendanceSummary?.LATE ?? 0} tone="amber" />
            <StatTile label={tx.attendanceRate} value={attendanceSummary?.percentage ?? 0} variant="percentage" tone="blue" />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {tx.recentRecords}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">{tx.date}</th>
                    <th className="px-5 py-3">{tx.state}</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendanceSummary?.recent || []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                        {tx.noRecords}
                      </td>
                    </tr>
                  )}
                  {(attendanceSummary?.recent || []).map((row: any) => (
                    <tr key={row.id} className="border-t dark:border-slate-700">
                      <td className="px-5 py-3">{dateBn(row.date)}</td>
                      <td className="px-5 py-3">{tx.attendanceStatus[row.status] || row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "financial" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label={tx.totalBilled} value={feeSummary?.totalBilled ?? 0} variant="currency" tone="slate" />
            <StatTile label={tx.paid} value={feeSummary?.totalPaid ?? 0} variant="currency" tone="emerald" />
            <StatTile label={tx.waived} value={feeSummary?.totalWaived ?? 0} variant="currency" tone="amber" />
            <StatTile label={tx.due} value={feeSummary?.totalDue ?? 0} variant="currency" tone="rose" />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tx.recentInvoices}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">{tx.head}</th>
                    <th className="px-5 py-3">{tx.dueDate}</th>
                    <th className="px-5 py-3">{tx.amount}</th>
                    <th className="px-5 py-3">{tx.paid}</th>
                    <th className="px-5 py-3">{tx.state}</th>
                  </tr>
                </thead>
                <tbody>
                  {(feeSummary?.recentInvoices || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                        {tx.noInvoices}
                      </td>
                    </tr>
                  )}
                  {(feeSummary?.recentInvoices || []).map((invoice: any) => (
                    <tr key={invoice.id} className="border-t dark:border-slate-700">
                      <td className="px-5 py-3">{invoice.title}</td>
                      <td className="px-5 py-3">{dateBn(invoice.dueDate)}</td>
                      <td className="px-5 py-3">{money(invoice.amount)}</td>
                      <td className="px-5 py-3">{money(invoice.paidAmount)}</td>
                      <td className="px-5 py-3">{tx.invoiceStatus[invoice.status] || invoice.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "library" && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b px-5 py-4 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tx.libraryRecords}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-start text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">{tx.bookName}</th>
                  <th className="px-5 py-3">{tx.borrowedDate}</th>
                  <th className="px-5 py-3">{tx.returnDate}</th>
                  <th className="px-5 py-3">{tx.state}</th>
                  <th className="px-5 py-3">{tx.fine}</th>
                </tr>
              </thead>
              <tbody>
                {libraryRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                      {tx.noRecords}
                    </td>
                  </tr>
                )}
                {libraryRecords.map((record: any) => (
                  <tr key={record.id} className="border-t dark:border-slate-700">
                    <td className="px-5 py-3">{record.book?.title}</td>
                    <td className="px-5 py-3">{dateBn(record.borrowedAt)}</td>
                    <td className="px-5 py-3">{dateBn(record.dueDate)}</td>
                    <td className="px-5 py-3">{tx.libraryStatus[record.status] || record.status}</td>
                    <td className="px-5 py-3">
                      {money(record.status === "BORROWED" ? record.estimatedFine : record.fineAmount)}
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
