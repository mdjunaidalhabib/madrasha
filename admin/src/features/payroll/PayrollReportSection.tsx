import { useEffect, useMemo, useState } from "react";
import { payrollApi, type PayrollStatus } from "../../services/phase2Api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { SkeletonList } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { formatNumber, localizeDigits, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { payrollText } from "./payroll.text";

type PayrollReportRow = {
  teacherId: number;
  month: string;
  netAmount: string | number;
  status: PayrollStatus;
  teacher?: { nameBn?: string; designation?: string | null } | null;
};

type MatrixCell = { status: PayrollStatus; amount: number };

type MatrixTeacher = {
  teacherId: number;
  name: string;
  designation: string;
  cells: Record<string, MatrixCell>;
  totalPaid: number;
  totalPending: number;
};


const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

const buildMonthKeys = (year: string) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

const monthLabelIn = (monthKey: string, months: string[]) => {
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  return months[monthIndex] || monthKey;
};

const moneyIn = (value: number, lang: Lang) => `৳${formatNumber(value, lang)}`;

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const PayrollReportSection = () => {
  const tx = useText(payrollText);
  const lang = useLang();
  const money = (value: number) => moneyIn(value, lang);
  const monthLabel = (monthKey: string) => monthLabelIn(monthKey, tx.months);
  const [year, setYear] = useState(String(currentYear));
  const [rows, setRows] = useState<PayrollReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnlyDue, setShowOnlyDue] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await payrollApi.list({ year });
        setRows(normalizeArray(res));
      } catch (err) {
        logger.error("LOAD PAYROLL REPORT ERROR:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  const monthKeys = useMemo(() => buildMonthKeys(year), [year]);

  const matrix = useMemo(() => {
    const byTeacher = new Map<number, MatrixTeacher>();
    rows.forEach((row) => {
      if (!byTeacher.has(row.teacherId)) {
        byTeacher.set(row.teacherId, {
          teacherId: row.teacherId,
          name: row.teacher?.nameBn || tx.teacherFallback(String(row.teacherId)),
          designation: row.teacher?.designation || "",
          cells: {},
          totalPaid: 0,
          totalPending: 0,
        });
      }
      const entry = byTeacher.get(row.teacherId)!;
      const amount = Number(row.netAmount) || 0;
      entry.cells[row.month] = { status: row.status, amount };
      if (row.status === "PAID") entry.totalPaid += amount;
      else entry.totalPending += amount;
    });
    return Array.from(byTeacher.values()).sort((a, b) => a.name.localeCompare(b.name, "bn"));
  }, [rows, tx]);

  const displayedMatrix = showOnlyDue ? matrix.filter((t) => t.totalPending > 0) : matrix;

  const monthTotals = useMemo(() => {
    const totals: Record<string, { paid: number; pending: number }> = {};
    monthKeys.forEach((m) => (totals[m] = { paid: 0, pending: 0 }));
    rows.forEach((row) => {
      const bucket = totals[row.month];
      if (!bucket) return;
      const amount = Number(row.netAmount) || 0;
      if (row.status === "PAID") bucket.paid += amount;
      else bucket.pending += amount;
    });
    return totals;
  }, [rows, monthKeys]);

  const summary = useMemo(
    () => ({
      teachersWithDue: matrix.filter((t) => t.totalPending > 0).length,
      totalDue: matrix.reduce((sum, t) => sum + t.totalPending, 0),
      totalPaid: matrix.reduce((sum, t) => sum + t.totalPaid, 0),
    }),
    [matrix],
  );

  const exportColumns = useMemo(
    () => [
      { header: tx.teacher, key: "name" },
      { header: tx.designation, key: "designation" },
      ...monthKeys.map((m) => ({ header: `${monthLabel(m)} ${localizeDigits(year, lang)}`, key: m })),
      { header: tx.totalDue, key: "totalPending" },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthKeys, year, tx, lang],
  );

  const exportData = useMemo(
    () =>
      displayedMatrix.map((t) => {
        const record: Record<string, any> = {
          name: t.name,
          designation: t.designation || "-",
          totalPending: money(t.totalPending || 0),
        };
        monthKeys.forEach((m) => {
          const cell = t.cells[m];
          record[m] = !cell
            ? tx.notGenerated
            : cell.status === "PAID"
              ? tx.paidWith(money(cell.amount))
              : tx.dueWith(money(cell.amount));
        });
        return record;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayedMatrix, monthKeys, tx, lang],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {localizeDigits(y, lang)}
                </option>
              ))}
            </select>

            <label className="flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-3 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showOnlyDue}
                onChange={(event) => setShowOnlyDue(event.target.checked)}
              />
              {tx.onlyDueTeachers}
            </label>
          </div>

          <DataExportPrintActions
            title={tx.registerTitle}
            columns={exportColumns}
            data={exportData}
            fileName={`payroll-register-${year}`}
            hidePrintOptions
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-slate-400">
          <span>{tx.teachersWithDue(formatNumber(summary.teachersWithDue, lang))}</span>
          <span className="text-amber-700 dark:text-amber-400">{tx.totalDue}: {money(summary.totalDue)}</span>
          <span className="text-green-700 dark:text-green-400">{tx.totalPaid}: {money(summary.totalPaid)}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
        {loading ? (
          <div className="p-3 sm:p-4">
            <SkeletonList items={6} />
          </div>
        ) : displayedMatrix.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">
            {tx.noRecordsForYear(localizeDigits(year, lang))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-center text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="sticky start-0 z-10 border border-slate-200 bg-slate-100 px-3 py-2 text-start font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {tx.teacher}
                  </th>
                  {monthKeys.map((m) => (
                    <th
                      key={m}
                      className="border border-slate-200 px-2 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="border border-slate-200 px-2 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {tx.totalDue}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedMatrix.map((t) => (
                  <tr key={t.teacherId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="sticky start-0 z-10 border border-slate-200 bg-white px-3 py-2 text-start dark:border-slate-700 dark:bg-slate-900">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{t.name}</div>
                      {t.designation && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.designation}</div>
                      )}
                    </td>
                    {monthKeys.map((m) => {
                      const cell = t.cells[m];
                      return (
                        <td key={m} className="border border-slate-200 px-2 py-2 dark:border-slate-700">
                          {!cell ? (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          ) : cell.status === "PAID" ? (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                              {money(cell.amount)}
                            </span>
                          ) : (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              {money(cell.amount)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 px-2 py-2 font-medium dark:border-slate-700">
                      {t.totalPending > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400">{money(t.totalPending)}</span>
                      ) : (
                        <span className="text-green-700 dark:text-green-400">{money(0)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-medium dark:bg-slate-800/60">
                  <td className="sticky start-0 z-10 border border-slate-200 bg-slate-50 px-3 py-2 text-start dark:border-slate-700 dark:bg-slate-800/60">
                    {tx.monthlyTotal}
                  </td>
                  {monthKeys.map((m) => (
                    <td key={m} className="border border-slate-200 px-2 py-1.5 text-[11px] dark:border-slate-700">
                      <div className="text-green-700 dark:text-green-400">{money(monthTotals[m].paid)}</div>
                      {monthTotals[m].pending > 0 && (
                        <div className="text-amber-700 dark:text-amber-400">{money(monthTotals[m].pending)}</div>
                      )}
                    </td>
                  ))}
                  <td className="border border-slate-200 dark:border-slate-700" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollReportSection;
