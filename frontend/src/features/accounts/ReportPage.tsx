import { useEffect, useMemo, useState } from "react";
import api, { cachedGet } from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import {
  ReportBackground,
  ReportBrandHeader,
  ReportWatermark,
} from "../../components/Report/ReportBranding";
import { logger } from "../../utils/logger";

type Row = { period: string; total_income: number | string; total_expense: number | string };

const filters = [
  { label: "দৈনিক", type: "daily", groupBy: "period" },
  { label: "মাসিক", type: "monthly", groupBy: "period" },
  { label: "বাৎসরিক", type: "yearly", groupBy: "period" },
  { label: "ফান্ড ভিত্তিক", type: "monthly", groupBy: "fund" },
  { label: "খাত ভিত্তিক", type: "monthly", groupBy: "category" },
];

const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

export default function ReportPage() {
  const [active, setActive] = useState(filters[1]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const exportRows = rows.map((row) => {
    const income = Number(row.total_income || 0);
    const expense = Number(row.total_expense || 0);
    return {
      period: row.period || "নির্ধারিত নয়",
      total_income: income,
      total_expense: expense,
      balance: income - expense,
    };
  });

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.income += Number(row.total_income || 0);
          acc.expense += Number(row.total_expense || 0);
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [rows],
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await cachedGet(`/accounts/report?type=${active.type}&groupBy=${active.groupBy}`);
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
        setRows(data);
      } catch (err) {
        logger.error("Accounts report load failed:", err);
        setRows([]);
        setError("রিপোর্ট লোড করা যায়নি। Backend/schema check করুন।");
      } finally {
        setLoading(false);
      }
    })();
  }, [active]);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="আয়-ব্যয় রিপোর্ট" subtitle="দৈনিক, মাসিক, ফান্ড ও খাতভিত্তিক রিপোর্ট" />
        <DataExportPrintActions
          title="আয়-ব্যয় রিপোর্ট"
          columns={[
            { header: "বিবরণ", key: "period" },
            { header: "আয়", key: "total_income" },
            { header: "ব্যয়", key: "total_expense" },
            { header: "ব্যালেন্স", key: "balance" },
          ]}
          data={exportRows}
          fileName={`income-expense-${active.type}-${active.groupBy}`}
        />
      </div>

      <div className="no-print flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={`${filter.type}-${filter.groupBy}-${filter.label}`}
            variant={active.label === filter.label ? "primary" : "secondary"}
            onClick={() => setActive(filter)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">মোট আয়</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{money(totals.income)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">মোট ব্যয়</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">{money(totals.expense)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">ব্যালেন্স</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {money(totals.income - totals.expense)}
          </p>
        </div>
      </div>

      <div className="print-area relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ReportBackground />
        <ReportWatermark />
        <ReportBrandHeader />
        <div className="overflow-x-auto">
        <table className="report-content-body w-full min-w-[720px]">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-5 py-4">বিবরণ</th>
              <th className="px-5 py-4">আয়</th>
              <th className="px-5 py-4">ব্যয়</th>
              <th className="px-5 py-4">ব্যালেন্স</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                  রিপোর্ট লোড হচ্ছে...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-5 py-8 text-center text-rose-600" colSpan={4}>
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                  কোনো ডাটা পাওয়া যায়নি
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const income = Number(row.total_income || 0);
                const expense = Number(row.total_expense || 0);
                return (
                  <tr key={`${row.period}-${i}`} className="border-t hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-800">
                      {row.period || "নির্ধারিত নয়"}
                    </td>
                    <td className="px-5 py-4 text-emerald-700">{money(income)}</td>
                    <td className="px-5 py-4 text-rose-700">{money(expense)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {money(income - expense)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
