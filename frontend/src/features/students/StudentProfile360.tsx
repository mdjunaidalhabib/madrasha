import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { toBanglaDigits } from "../../utils/reportUtils";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonCard, SkeletonTable } from "../../components/ui/Skeleton";
import { logger } from "../../utils/logger";
import { useToastStore } from "../../store/toastStore";
import StudentInfoProfile from "../../components/studentProfile/StudentInfoProfile";
import ParentInfoProfile from "../../components/studentProfile/ParentInfoProfile";
import AddressInfoProfile from "../../components/studentProfile/AddressInfoProfile";

const TABS = [
  { key: "overview", label: "ওভারভিউ" },
  { key: "academic", label: "একাডেমিক" },
  { key: "attendance", label: "উপস্থিতি" },
  { key: "financial", label: "আর্থিক" },
  { key: "library", label: "লাইব্রেরি" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const money = (value: number | string | undefined) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

const dateBn = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("bn-BD") : "-";

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: "উপস্থিত",
  ABSENT: "অনুপস্থিত",
  LATE: "বিলম্বে",
  LEAVE: "ছুটি",
};

const LIBRARY_STATUS_LABEL: Record<string, string> = {
  BORROWED: "ধারে দেওয়া আছে",
  RETURNED: "ফেরত দেওয়া হয়েছে",
  LOST: "হারিয়ে গেছে",
};

const PROMOTION_STATUS_LABEL: Record<string, string> = {
  PROMOTED: "উন্নীত",
  RETAINED: "অবস্থান",
  TRANSFERRED: "স্থানান্তরিত",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: "বকেয়া",
  PARTIALLY_PAID: "আংশিক পরিশোধিত",
  PAID: "পরিশোধিত",
  WAIVED: "মওকুফ",
};

export default function StudentProfile360() {
  const { id, madrasaSlug = "" } = useParams();
  const navigate = useNavigate();
  const adminBase = getTenantAdminBase(madrasaSlug);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");

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
        useToastStore.getState().show("প্রোফাইল লোড করা যায়নি", "error");
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
        <EmptyState title="শিক্ষার্থী পাওয়া যায়নি" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={student.nameBn || "শিক্ষার্থী প্রোফাইল"}
        subtitle={`${className} · রোল ${student.roll ? toBanglaDigits(student.roll) : "নেই"} · রেজি. ${
          student.registrationNo ? toBanglaDigits(student.registrationNo) : "নেই"
        }`}
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate(`${adminBase}/students/${id}`, { state: { autoEdit: true } })}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              সম্পাদনা
            </button>
            <button
              type="button"
              onClick={() => navigate(`${adminBase}/reports/documents`)}
              className="h-9 rounded-md bg-teal-600 px-3 text-sm font-medium text-white hover:bg-teal-700"
            >
              আইডি কার্ড প্রিন্ট
            </button>
            <button
              type="button"
              onClick={() => navigate(`${adminBase}/reports/documents`)}
              className="h-9 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              মার্কশিট ডাউনলোড
            </button>
            <button
              type="button"
              onClick={() => navigate(`${adminBase}/fee-collection`)}
              className="h-9 rounded-md bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700"
            >
              ফি কালেক্ট
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
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="হাজিরার হার" value={attendanceSummary?.percentage ?? 0} variant="percentage" tone="blue" />
          <StatTile label="প্রকাশিত ফলাফল" value={results.length} tone="indigo" />
          <StatTile label="বকেয়া ফি" value={feeSummary?.totalDue ?? 0} variant="currency" tone="rose" />
          <StatTile label="লাইব্রেরি রেকর্ড" value={libraryRecords.length} tone="amber" />

          <div className="sm:col-span-2 lg:col-span-4 overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">মৌলিক তথ্য</h2>
            </div>
            <dl className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">পিতার নাম</dt>
                <dd className="text-gray-700 dark:text-slate-300">{student.fatherName || "নেই"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">অভিভাবকের ফোন</dt>
                <dd className="text-gray-700 dark:text-slate-300">{student.guardianPhone || "নেই"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">শিক্ষাবর্ষ</dt>
                <dd className="text-gray-700 dark:text-slate-300">{student.academicYear || "নেই"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">ভর্তির তারিখ</dt>
                <dd className="text-gray-700 dark:text-slate-300">{dateBn(student.admissionDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-slate-500">অবস্থা</dt>
                <dd className="text-gray-700 dark:text-slate-300">
                  {Number(student.isActive) === 0 ? "বহিষ্কৃত" : "সক্রিয়"}
                </dd>
              </div>
            </dl>
          </div>

          {fullStudent && (
            <div className="sm:col-span-2 lg:col-span-4 space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b px-5 py-4 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ছবি</h2>
                </div>
                <div className="flex justify-center p-5">
                  <div
                    className="h-40 w-40 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 bg-cover bg-center dark:border-slate-600 dark:bg-slate-800"
                    style={{ backgroundImage: fullStudent.image ? `url(${fullStudent.image})` : undefined }}
                  >
                    {!fullStudent.image && (
                      <div className="flex h-full items-center justify-center text-center text-sm text-gray-400 dark:text-slate-500">
                        ছবি নেই
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">পরীক্ষার ফলাফল</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">পরীক্ষা</th>
                    <th className="px-5 py-3">শ্রেণি</th>
                    <th className="px-5 py-3">অবস্থা</th>
                    <th className="px-5 py-3">মোট নম্বর</th>
                    <th className="px-5 py-3">গড়</th>
                    <th className="px-5 py-3">গ্রেড</th>
                    <th className="px-5 py-3">মেধাক্রম</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                        কোনো ফলাফল পাওয়া যায়নি
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
                        {row.resultMaster?.status === "PUBLISHED" ? "প্রকাশিত" : "খসড়া"}
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">পদোন্নতির ইতিহাস</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">শিক্ষাবর্ষ</th>
                    <th className="px-5 py-3">রোল পরিবর্তন</th>
                    <th className="px-5 py-3">অবস্থা</th>
                    <th className="px-5 py-3">তারিখ</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        কোনো তথ্য নেই
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
                      <td className="px-5 py-3">{PROMOTION_STATUS_LABEL[row.status] || row.status}</td>
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
            <StatTile label="উপস্থিত" value={attendanceSummary?.PRESENT ?? 0} tone="emerald" />
            <StatTile label="অনুপস্থিত" value={attendanceSummary?.ABSENT ?? 0} tone="rose" />
            <StatTile label="বিলম্বে" value={attendanceSummary?.LATE ?? 0} tone="amber" />
            <StatTile label="হাজিরার হার" value={attendanceSummary?.percentage ?? 0} variant="percentage" tone="blue" />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                সাম্প্রতিক রেকর্ড (গত ৩০ দিন)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">তারিখ</th>
                    <th className="px-5 py-3">অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendanceSummary?.recent || []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                        কোনো রেকর্ড নেই
                      </td>
                    </tr>
                  )}
                  {(attendanceSummary?.recent || []).map((row: any) => (
                    <tr key={row.id} className="border-t dark:border-slate-700">
                      <td className="px-5 py-3">{dateBn(row.date)}</td>
                      <td className="px-5 py-3">{ATTENDANCE_STATUS_LABEL[row.status] || row.status}</td>
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
            <StatTile label="মোট বিল" value={feeSummary?.totalBilled ?? 0} variant="currency" tone="slate" />
            <StatTile label="পরিশোধিত" value={feeSummary?.totalPaid ?? 0} variant="currency" tone="emerald" />
            <StatTile label="মওকুফ" value={feeSummary?.totalWaived ?? 0} variant="currency" tone="amber" />
            <StatTile label="বকেয়া" value={feeSummary?.totalDue ?? 0} variant="currency" tone="rose" />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">সাম্প্রতিক ইনভয়েস</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">খাত</th>
                    <th className="px-5 py-3">নির্ধারিত তারিখ</th>
                    <th className="px-5 py-3">পরিমাণ</th>
                    <th className="px-5 py-3">পরিশোধিত</th>
                    <th className="px-5 py-3">অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {(feeSummary?.recentInvoices || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                        কোনো ইনভয়েস নেই
                      </td>
                    </tr>
                  )}
                  {(feeSummary?.recentInvoices || []).map((invoice: any) => (
                    <tr key={invoice.id} className="border-t dark:border-slate-700">
                      <td className="px-5 py-3">{invoice.title}</td>
                      <td className="px-5 py-3">{dateBn(invoice.dueDate)}</td>
                      <td className="px-5 py-3">{money(invoice.amount)}</td>
                      <td className="px-5 py-3">{money(invoice.paidAmount)}</td>
                      <td className="px-5 py-3">{INVOICE_STATUS_LABEL[invoice.status] || invoice.status}</td>
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">লাইব্রেরি রেকর্ড</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">বইয়ের নাম</th>
                  <th className="px-5 py-3">নেওয়ার তারিখ</th>
                  <th className="px-5 py-3">ফেরতের তারিখ</th>
                  <th className="px-5 py-3">অবস্থা</th>
                  <th className="px-5 py-3">জরিমানা</th>
                </tr>
              </thead>
              <tbody>
                {libraryRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                      কোনো রেকর্ড নেই
                    </td>
                  </tr>
                )}
                {libraryRecords.map((record: any) => (
                  <tr key={record.id} className="border-t dark:border-slate-700">
                    <td className="px-5 py-3">{record.book?.title}</td>
                    <td className="px-5 py-3">{dateBn(record.borrowedAt)}</td>
                    <td className="px-5 py-3">{dateBn(record.dueDate)}</td>
                    <td className="px-5 py-3">{LIBRARY_STATUS_LABEL[record.status] || record.status}</td>
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
