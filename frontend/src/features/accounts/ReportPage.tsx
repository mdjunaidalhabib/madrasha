import { useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import DataExportPrintActions, { Orientation, PaperSize } from "../../components/common/DataExportPrintActions";
import PaginatedReportPreview from "../../components/Report/PaginatedReportPreview";
import { ReportMenuItem } from "../../features/reports/types";
import { logger } from "../../utils/logger";

type Row = { period: string; total_income: number | string; total_expense: number | string };

const reportMeta: ReportMenuItem = {
  key: "income-expense-report",
  title: "আয়-ব্যয় রিপোর্ট",
  subtitle: "দৈনিক, মাসিক, ফান্ড ও খাতভিত্তিক রিপোর্ট",
  endpoint: "/accounts/report",
  printable: "table",
  columns: [
    { header: "বিবরণ", key: "period" },
    { header: "আয়", key: "total_income" },
    { header: "ব্যয়", key: "total_expense" },
    { header: "ব্যালেন্স", key: "balance" },
  ],
};

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
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const exportRows = rows.map((row) => {
    const income = Number(row.total_income || 0);
    const expense = Number(row.total_expense || 0);
    return {
      period: row.period || "নির্ধারিত নয়",
      total_income: income,
      total_expense: expense,
      balance: income - expense,
    };
  });

  const previewRows = exportRows.map((row) => ({
    period: row.period,
    total_income: money(row.total_income),
    total_expense: money(row.total_expense),
    balance: money(row.balance),
  }));

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
        setError("রিপোর্ট লোড করা যায়নি। Backend/schema check করুন।");
      } finally {
        setLoading(false);
      }
    })();
  }, [active]);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="আয়-ব্যয় রিপোর্ট" subtitle="দৈনিক, মাসিক, ফান্ড ও খাতভিত্তিক রিপোর্ট" />
        <DataExportPrintActions
          title="আয়-ব্যয় রিপোর্ট"
          columns={[
            { header: "বিবরণ", key: "period" },
            { header: "আয়", key: "total_income" },
            { header: "ব্যয়", key: "total_expense" },
            { header: "ব্যালেন্স", key: "balance" },
          ]}
          data={exportRows}
          fileName={`income-expense-${active.type}-${active.groupBy}`}
          paperSize={paperSize}
          orientation={orientation}
          onPaperSizeChange={setPaperSize}
          onOrientationChange={setOrientation}
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

      <div className="no-print grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">মোট আয়</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{money(totals.income)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">মোট ব্যয়</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">{money(totals.expense)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">ব্যালেন্স</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {money(totals.income - totals.expense)}
          </p>
        </div>
      </div>

      {error && (
        <div className="no-print rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-rose-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="print-preview-wrap">
          <PaginatedReportPreview
            loading={loading}
            report={reportMeta}
            rows={previewRows}
            paperSize={paperSize}
            orientation={orientation}
          />
        </div>
      </div>
    </div>
  );
}
