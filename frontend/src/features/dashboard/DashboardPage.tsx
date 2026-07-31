import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import StatTile from "../../components/ui/StatTile";
import { getTenantAdminBase } from "../../utils/tenantSlug";

const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  useEffect(() => {
    (async () => {
      const res = await cachedGet("/dashboard");
      setData(res.data);
    })();
  }, []);

  const loading = !data;

  const cards = loading
    ? []
    : [
        { label: "মোট ছাত্র", value: data.students, tone: "blue" as const },
        { label: "মোট শিক্ষক", value: data.teachers, tone: "indigo" as const },
        { label: "মোট আয়", value: data.income, tone: "emerald" as const, variant: "currency" as const },
        { label: "মোট ব্যয়", value: data.expense, tone: "rose" as const, variant: "currency" as const },
        {
          label: "বর্তমান ব্যালেন্স",
          value: data.balance,
          tone: "slate" as const,
          variant: "currency" as const,
        },
        {
          label: "আজকের আয়/ব্যয়",
          value: data.todayIncome,
          tone: "amber" as const,
          variant: "currency" as const,
          subLabel: `ব্যয়: ${money(data.todayExpense)}`,
        },
      ];

  return (
    <div className="space-y-6">
      <PageHeader title="ড্যাশবোর্ড" subtitle="মাদরাসার এক নজরের সারাংশ" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <StatTile key={i} label="" value="" loading />)
          : cards.map((card) => <StatTile key={card.label} {...card} />)}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatTile key={i} label="" value="" loading />)
        ) : (
          <>
            <StatTile
              label="আজকের হাজিরা %"
              value={data.attendanceToday.percentage}
              variant="percentage"
              tone="emerald"
              subLabel={`${data.attendanceToday.total} জনের হাজিরা নেওয়া হয়েছে`}
              to={`${adminBase}/attendance/mark`}
            />
            <StatTile
              label="অনুমোদনের অপেক্ষায় ভর্তি"
              value={data.pendingAdmissionsCount}
              tone="amber"
              to={`${adminBase}/students/admissions/pending`}
            />
            <StatTile
              label="বকেয়া ফি"
              value={data.overdueFees.totalDue}
              variant="currency"
              tone="rose"
              subLabel={`${data.overdueFees.count} টি ইনভয়েস`}
              to={`${adminBase}/fee-management`}
            />
            <StatTile
              label="আসন্ন পরীক্ষা"
              value={data.upcomingExams.length}
              tone="indigo"
              to={`${adminBase}/routine`}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">ফান্ড ব্যালেন্স</h2>
            <Link className="text-sm font-medium text-blue-600" to={`${adminBase}/accounts/report`}>
              রিপোর্ট দেখুন
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.fundBalances || []).map((fund: any) => (
              <div
                key={fund.fund || "empty"}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="font-medium text-slate-700">{fund.fund || "নির্ধারিত নয়"}</span>
                <span className="font-bold text-slate-900">{money(fund.balance)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">দ্রুত কাজ</h2>
          <div className="grid gap-3">
            <Link
              className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white"
              to={`${adminBase}/accounts/income`}
            >
              আয় এন্ট্রি
            </Link>
            <Link
              className="rounded-xl bg-rose-600 px-4 py-3 text-center text-sm font-semibold text-white"
              to={`${adminBase}/accounts/expense`}
            >
              ব্যয় এন্ট্রি
            </Link>
            <Link
              className="rounded-xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-white"
              to={`${adminBase}/students/new_admission`}
            >
              নতুন ভর্তি
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">আসন্ন পরীক্ষা</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">তারিখ</th>
                <th className="px-5 py-3">পরীক্ষা</th>
                <th className="px-5 py-3">শ্রেণি</th>
                <th className="px-5 py-3">বিষয়</th>
                <th className="px-5 py-3">সময়</th>
              </tr>
            </thead>
            <tbody>
              {(data?.upcomingExams || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    আসন্ন কোনো পরীক্ষা নেই
                  </td>
                </tr>
              )}
              {(data?.upcomingExams || []).map((exam: any) => (
                <tr key={exam.id} className="border-t">
                  <td className="px-5 py-3">{new Date(exam.examDate).toLocaleDateString("bn-BD")}</td>
                  <td className="px-5 py-3">{exam.examName}</td>
                  <td className="px-5 py-3">{exam.className}</td>
                  <td className="px-5 py-3">{exam.subject}</td>
                  <td className="px-5 py-3">
                    {exam.startTime} - {exam.endTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">সাম্প্রতিক হিসাব</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">তারিখ</th>
                <th className="px-5 py-3">ধরন</th>
                <th className="px-5 py-3">ফান্ড</th>
                <th className="px-5 py-3">খাত</th>
                <th className="px-5 py-3">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentTransactions || []).map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="px-5 py-3">{item.entry_date}</td>
                  <td className="px-5 py-3">{item.type === "income" ? "আয়" : "ব্যয়"}</td>
                  <td className="px-5 py-3">{item.fund}</td>
                  <td className="px-5 py-3">{item.category}</td>
                  <td className="px-5 py-3 font-semibold">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
