import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";

const formatDob = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("bn-BD");
};

const STATUS_LABEL: Record<string, string> = {
  PASS: "পাশ",
  FAIL: "ফেল",
  ABSENT: "অনুপস্থিত",
};

export default function GuardianMarksheetPage() {
  const { resultMasterId } = useParams();
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const madrasaSlug = useTenantSlug();
  const base = getTenantGuardianBase(madrasaSlug);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!selectedStudentId || !resultMasterId) return;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const res = await guardianApi.get(
          `/guardian/students/${selectedStudentId}/results/${resultMasterId}`,
        );
        setData(res.data?.data || null);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedStudentId, resultMasterId]);

  if (!selectedStudentId) {
    return <EmptyState title="কোনো সন্তান যুক্ত নেই" />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="মার্কশিট" />
        <SkeletonCard lines={8} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <EmptyState
        title="ফলাফল পাওয়া যায়নি"
        hint="এই মার্কশিট প্রকাশিত নয় অথবা আপনার সন্তানের সাথে সম্পর্কিত নয়।"
        action={
          <Link
            to={`${base}/results`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ফলাফল তালিকায় ফিরে যান
          </Link>
        }
      />
    );
  }

  const rowStatus = String(data.status || "").toUpperCase();
  const failed = rowStatus === "FAIL";
  const isAbsent = rowStatus === "ABSENT";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PageHeader title="মার্কশিট" subtitle={`${data.examName} - ${data.examYear}`} />
        <div className="flex gap-2">
          <Link
            to={`${base}/results`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ফিরে যান
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            প্রিন্ট করুন
          </button>
        </div>
      </div>

      <section
        className={`mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none sm:p-8 ${
          failed ? "bg-red-50" : isAbsent ? "bg-amber-50" : "bg-white"
        }`}
      >
        <div className="border-b-2 border-black pb-3 text-center text-black">
          <h2 className="text-2xl font-bold text-black">মার্কশিট</h2>
          <p className="mt-1 text-sm font-semibold text-black">শ্রেণিঃ {data.className}</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {data.examName} - {data.examYear} ইং
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 py-3 text-sm text-black sm:grid-cols-3">
          <p>
            <b>রোল নম্বর:</b> {data.roll ?? "—"}
          </p>
          <p>
            <b>রেজিস্ট্রেশন নম্বর:</b> {data.registrationNo ?? "—"}
          </p>
          <p>
            <b>জন্ম তারিখ:</b> {formatDob(data.dob)}
          </p>
          <p>
            <b>শিক্ষার্থীর নাম:</b> {data.studentName}
          </p>
          <p>
            <b>পিতার নাম:</b> {data.fatherName || "—"}
          </p>
          <p>
            <b>ফলাফল বিভাগ:</b> {data.madrasaGrade || "—"}
          </p>
          <p>
            <b>গ্রেড:</b> {data.generalGrade || "—"}
          </p>
          <p>
            <b>মেধাস্থান:</b> {data.rankNo ?? "—"}
          </p>
          <p>
            <b>অবস্থা:</b> {STATUS_LABEL[rowStatus] || rowStatus || "—"}
          </p>
        </div>

        {data.subjects?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="mt-4 w-full min-w-[420px] border-collapse text-sm text-black">
              <thead>
                <tr className="bg-slate-100">
                  <th className="w-12 border border-black px-2 py-2 text-center">ক্রম</th>
                  <th className="border border-black px-3 py-2 text-left">বিষয়ের নাম</th>
                  <th className="w-24 border border-black px-3 py-2 text-center">প্রাপ্ত নম্বর</th>
                  <th className="w-24 border border-black px-3 py-2 text-center">পূর্ণমান</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((subject: any, index: number) => (
                  <tr key={subject.bookId ?? index}>
                    <td className="border border-black px-2 py-1.5 text-center">{index + 1}</td>
                    <td className="border border-black px-3 py-1.5">{subject.subjectName || "—"}</td>
                    <td className="border border-black px-3 py-1.5 text-center font-semibold">
                      {subject.isAbsent ? "অনু" : (subject.mark ?? "—")}
                    </td>
                    <td className="border border-black px-3 py-1.5 text-center">
                      {subject.fullMarks ?? "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td colSpan={2} className="border border-black px-3 py-1.5 font-semibold">
                    মোট নম্বর
                  </td>
                  <td colSpan={2} className="border border-black px-3 py-1.5 text-center font-bold">
                    {data.total}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td colSpan={2} className="border border-black px-3 py-1.5 font-semibold">
                    গড় নম্বর
                  </td>
                  <td colSpan={2} className="border border-black px-3 py-1.5 text-center font-bold">
                    {data.average}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
