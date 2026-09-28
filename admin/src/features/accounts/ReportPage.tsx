import { useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import DataExportPrintActions, { Orientation, PaperSize } from "../../components/common/DataExportPrintActions";
import PaginatedReportPreview from "../../components/Report/PaginatedReportPreview";
import { ReportMenuItem } from "../../features/reports/types";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { formatCurrency, usePrintLang, usePrintText, useText } from "@madrasha/shared-ui/src/i18n";
import { money } from "./accountHelpers";
import { accountsPrintText, accountsText } from "./accounts.text";

type Row = {
  period?: string;
  fund?: string;
  category?: string;
  total_income: number | string;
  total_expense: number | string;
};

const filters = [
  { key: "daily", type: "daily", groupBy: "period" },
  { key: "monthly", type: "monthly", groupBy: "period" },
  { key: "yearly", type: "yearly", groupBy: "period" },
  { key: "byFund", type: "monthly", groupBy: "fund" },
  { key: "byCategory", type: "monthly", groupBy: "category" },
  { key: "fundCategory", type: "monthly", groupBy: "fund_category" },
] as const;

export default function ReportPage() {
  const t = useText(accountsText);
  const p = usePrintText(accountsPrintText);
  const { lang: printLang } = usePrintLang();
  const printMoney = (value: number | string) => formatCurrency(Number(value || 0), printLang);
  const [active, setActive] = useState<(typeof filters)[number]>(filters[1]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const isFundCategory = active.groupBy === "fund_category";
  const columns = useMemo(
    () =>
      isFundCategory
        ? [
            { header: p.fund, key: "fund" },
            { header: p.category, key: "category" },
            { header: p.income, key: "total_income" },
            { header: p.expense, key: "total_expense" },
            { header: p.balance, key: "balance" },
          ]
        : [
            { header: p.description, key: "period" },
            { header: p.income, key: "total_income" },
            { header: p.expense, key: "total_expense" },
            { header: p.balance, key: "balance" },
          ],
    [isFundCategory, p],
  );

  const reportMeta: ReportMenuItem = useMemo(
    () => ({
      key: "income-expense-report",
      title: p.reportTitle,
      subtitle: p.reportSubtitle(p.reportFilters[active.key]),
      endpoint: "/accounts/report",
      printable: "table",
      columns,
    }),
    [columns, active.key, p],
  );

  type ExportRow = {
    period?: string;
    fund?: string;
    category?: string;
    total_income: number;
    total_expense: number;
    balance: number;
    __bold?: boolean;
  };

  // ফান্ড ও খাত বিস্তারিত মোডে প্রতিটি ফান্ডের জন্য একটি বোল্ড সাবটোটাল সারি,
  // তারপর সেই ফান্ডের আওতাধীন প্রতিটি খাতের নিজস্ব সারি দেখানো হয় - যাতে
  // প্রত্যেক ফান্ড ও খাতের বিস্তারিত তথ্য এক নজরে বোঝা যায়।
  const exportRows = useMemo<ExportRow[]>(() => {
    if (!isFundCategory) {
      return rows.map((row) => {
        const income = Number(row.total_income || 0);
        const expense = Number(row.total_expense || 0);
        return {
          period: row.period || p.unassigned,
          total_income: income,
          total_expense: expense,
          balance: income - expense,
        };
      });
    }

    const fundOrder: string[] = [];
    const byFund = new Map<string, Row[]>();
    rows.forEach((row) => {
      const fund = row.fund || p.unassigned;
      if (!byFund.has(fund)) {
        byFund.set(fund, []);
        fundOrder.push(fund);
      }
      byFund.get(fund)!.push(row);
    });

    const result: ExportRow[] = [];

    fundOrder.forEach((fund) => {
      const categoryRows = byFund.get(fund)!;
      const fundIncome = categoryRows.reduce((sum, r) => sum + Number(r.total_income || 0), 0);
      const fundExpense = categoryRows.reduce((sum, r) => sum + Number(r.total_expense || 0), 0);

      result.push({
        fund,
        category: p.grandTotal,
        total_income: fundIncome,
        total_expense: fundExpense,
        balance: fundIncome - fundExpense,
        __bold: true,
      });

      categoryRows.forEach((row) => {
        const income = Number(row.total_income || 0);
        const expense = Number(row.total_expense || 0);
        result.push({
          fund: "",
          category: row.category || p.unassigned,
          total_income: income,
          total_expense: expense,
          balance: income - expense,
        });
      });
    });

    return result;
  }, [rows, isFundCategory, p]);

  const previewRows = exportRows.map((row) => ({
    ...row,
    total_income: printMoney(row.total_income),
    total_expense: printMoney(row.total_expense),
    balance: printMoney(row.balance),
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
        setError(t.reportLoadFailed);
      } finally {
        setLoading(false);
      }
    })();
  }, [active]);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title={t.incomeExpenseReport} subtitle={t.reportSubtitle} />
        <DataExportPrintActions
          title={p.reportTitle}
          columns={columns}
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
            key={`${filter.type}-${filter.groupBy}-${filter.key}`}
            variant={active.key === filter.key ? "primary" : "secondary"}
            onClick={() => setActive(filter)}
          >
            {t.reportFilters[filter.key]}
          </Button>
        ))}
      </div>

      <div className="no-print grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.totalIncome}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{money(totals.income)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.totalExpense}</p>
          <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{money(totals.expense)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.balance}</p>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-400">
            {money(totals.income - totals.expense)}
          </p>
        </div>
      </div>

      {error && (
        <div className="no-print rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
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
