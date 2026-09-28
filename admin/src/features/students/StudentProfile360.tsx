import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStudentIdParam } from "./studentRoute";
import api, { cachedGet } from "../../services/api";
import { useText, getText, useLang, localizeDigits, formatCurrency, formatDate } from "@madrasha/shared-ui/src/i18n";
import { profile360Text } from "./StudentProfile360.text";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import StatTile from "@madrasha/shared-ui/src/components/ui/StatTile";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { SkeletonCard, SkeletonTable } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { studentStatusLabel } from "../../utils/studentStatus";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";

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
  const id = useStudentIdParam();
  const tx = useText(profile360Text);
  const lang = useLang();
  const toBanglaDigits = (v: string | number) => localizeDigits(v, lang);
  const money = (value: number | string | undefined) => formatCurrency(value || 0, lang);
  const dateBn = (value: string | Date | null | undefined) => (value ? formatDate(value, lang) : "-");
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // ট্যাব URL-এ থাকে: /students/:id (ওভারভিউ) বা /students/:id/:tab
  const { tab: tabSlug } = useParams();
  const tab = tabFromSlug(tabSlug);
  const setTab = (key: TabKey) => {
    const slug = TABS.find((t) => t.key === key)?.slug;
    navigate(slug ? `/students/${ref}/${slug}` : `/students/${ref}`, { replace: true });
  };

  // পূর্ণাঙ্গ (বিস্তারিত) তথ্য — ছাত্র/অভিভাবক/ঠিকানার সব ফিল্ড, শুধু দেখার জন্য (রিড-অনলি)
  const [fullStudent, setFullStudent] = useState<any>(null);
  const noop = () => {};

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/students/${id}/profile-360`);
        setData(res.data?.data || null);
      } catch (error) {
        logger.error("FETCH STUDENT PROFILE 360 ERROR:", error);
        useToastStore.getState().show(getText(profile360Text).loadFailed, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await cachedGet(`/students/${id}`);
        setFullStudent(res.data?.data || null);
      } catch (error) {
        logger.error("FETCH STUDENT FULL DETAILS ERROR:", error);
      }
    })();
  }, [id]);

  const student = data?.student;
  const results = data?.results || [];
  const attendanceSummary = data?.attendanceSummary;
  const feeSummary = data?.feeSummary;
  const libraryRecords = data?.libraryRecords || [];
  const promotionHistory = data?.promotionHistory || [];

  const className = useMemo(
    () => student?.classRef?.nameBn || student?.classRef?.name || "-",
    [student],
  );

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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <SkeletonCard lines={4} />
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <EmptyState title={tx.notFound} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={student.nameBn || tx.profileTitle}
        subtitle={tx.subtitle(
          className,
          student.roll ? toBanglaDigits(student.roll) : tx.none,
          student.registrationNo ? toBanglaDigits(student.registrationNo) : tx.none,
        )}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate(`/students/${ref}/edit`, { state: { autoEdit: true } })}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {tx.edit}
            </button>
            <button
              type="button"
              onClick={() => navigate(documentsLink("student-id-cards"))}
              className="h-9 rounded-md bg-teal-600 px-3 text-sm font-medium text-white hover:bg-teal-700"
            >
              {tx.printIdCard}
            </button>
            <button
              type="button"
              onClick={() => navigate(documentsLink("student-marksheets", latestPublishedExamId))}
              className="h-9 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {tx.downloadMarksheet}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/fee-collection?student_id=${student.id}`)}
              className="h-9 rounded-md bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700"
            >
              {tx.collectFee}
            </button>
          </>
        }
      />

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tx.tabs[t.key]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={tx.attendanceRate} value={attendanceSummary?.percentage ?? 0} variant="percentage" tone="blue" />
          <StatTile label={tx.publishedResults} value={results.length} tone="indigo" />
          <StatTile label={tx.dueFee} value={feeSummary?.totalDue ?? 0} variant="currency" tone="rose" />
          <StatTile label={tx.libraryRecords} value={libraryRecords.length} tone="amber" />

          <div className="sm:col-span-2 lg:col-span-4 overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tx.basicInfo}</h2>
            </div>
            <dl className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">{tx.fatherName}</dt>
                <dd className="text-gray-700 dark:text-slate-300">{student.fatherName || tx.none}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">{tx.guardianPhone}</dt>
                <dd className="text-gray-700 dark:text-slate-300">{student.guardianPhone || tx.none}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">{tx.session}</dt>
                <dd className="text-gray-700 dark:text-slate-300">{student.academicYear || tx.none}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">{tx.admissionDate}</dt>
                <dd className="text-gray-700 dark:text-slate-300">{dateBn(student.admissionDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">{tx.state}</dt>
                <dd className="text-gray-700 dark:text-slate-300">
                  {studentStatusLabel(student.isActive)}
                </dd>
              </div>
            </dl>
          </div>

          {fullStudent && (
            <div className="sm:col-span-2 lg:col-span-4 space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b px-5 py-4 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tx.photo}</h2>
                </div>
                <div className="flex justify-center p-5">
                  <div
                    className="h-40 w-40 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 bg-cover bg-center dark:border-slate-600 dark:bg-slate-800"
                    style={{ backgroundImage: fullStudent.image ? `url(${fullStudent.image})` : undefined }}
                  >
                    {!fullStudent.image && (
                      <div className="flex h-full items-center justify-center text-center text-sm text-gray-400 dark:text-slate-500">
                        {tx.noPhoto}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <StudentInfoProfile
                student={fullStudent}
                handleChange={noop}
                setStudent={setFullStudent}
                editableField={null}
                setEditableField={noop}
                isEditMode={false}
              />

              <ParentInfoProfile
                student={fullStudent}
                handleChange={noop}
                editableField={null}
                setEditableField={noop}
                isEditMode={false}
              />

              <AddressInfoProfile
                student={fullStudent}
                handleChange={noop}
                editableField={null}
                setEditableField={noop}
                isEditMode={false}
              />
            </div>
          )}
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
