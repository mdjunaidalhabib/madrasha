import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import { getTenantAdminBase } from "../../utils/tenantSlug";

const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);

  useEffect(() => {
    (async () => {
      const res = await api.get("/dashboard");
      setData(res.data);
    })();
  }, []);

  if (!data) {
    return (
      <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">
        ড্যাশবোর্ড লোড হচ্ছে...
      </div>
    );
  }

  const cards = [
    { label: "মোট ছাত্র", value: data.students, tone: "text-blue-700", bg: "bg-blue-50" },
    { label: "মোট শিক্ষক", value: data.teachers, tone: "text-indigo-700", bg: "bg-indigo-50" },
    { label: "মোট আয়", value: money(data.income), tone: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "মোট ব্যয়", value: money(data.expense), tone: "text-rose-700", bg: "bg-rose-50" },
    {
      label: "বর্তমান ব্যালেন্স",
      value: money(data.balance),
      tone: "text-slate-900",
      bg: "bg-slate-50",
    },
    {
      label: "আজকের আয়/ব্যয়",
      value: `${money(data.todayIncome)} / ${money(data.todayExpense)}`,
      tone: "text-amber-700",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="ড্যাশবোর্ড" subtitle="মাদরাসার এক নজরের সারাংশ" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-slate-200 ${card.bg} p-5 shadow-sm`}
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
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
            {(data.fundBalances || []).map((fund: any) => (
              <div
                key={fund.fund || "empty"}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="font-medium text-slate-700">{fund.fund || "নির্ধারিত নয়"}</span>
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
              আয় এন্ট্রি
            </Link>
            <Link
              className="rounded-xl bg-rose-600 px-4 py-3 text-center text-sm font-semibold text-white"
              to={`${adminBase}/accounts/expense`}
            >
              ব্যয় এন্ট্রি
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
          <h2 className="text-lg font-bold text-slate-900">সাম্প্রতিক হিসাব</h2>
        </div>
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
            {(data.recentTransactions || []).map((item: any) => (
              <tr key={item.id} className="border-t">
                <td className="px-5 py-3">{item.entry_date}</td>
                <td className="px-5 py-3">{item.type === "income" ? "আয়" : "ব্যয়"}</td>
                <td className="px-5 py-3">{item.fund}</td>
                <td className="px-5 py-3">{item.category}</td>
                <td className="px-5 py-3 font-semibold">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
