import { useMemo } from "react";
import { useIsMadrasa, usePrintText, useText } from "@madrasha/shared-ui/src/i18n";
import { reportText, type ReportText } from "../../components/Report/report.text";
import { reportsText, type ReportsText } from "./reports.text";
import type { ReportMenuItem } from "./types";

export type ReportBuilder = (t: ReportsText, col: ReportText["col"], isMadrasa: boolean) => ReportMenuItem[];

const registrationPrintables = new Set([
  "attendance-register", "daily-attendance-register", "digital-attendance",
]);

const applyColumnDefaults = (reports: ReportMenuItem[], col: ReportText["col"]): ReportMenuItem[] =>
  reports.map((report) => {
    const options = [...(report.columnOptions ?? report.columns)];
    if (registrationPrintables.has(report.printable ?? "") && !options.some((c) => c.key === "registration_no")) {
      options.splice(1, 0, { key: "registration_no", header: col.regNoFull });
    }
    if (!options.some((c) => c.key === "registration_no")) return report;
    return {
      ...report,
      columns: report.columns.filter((c) => c.key !== "registration_no"),
      columnOptions: options,
    };
  });

/**
 * Builds a page's report menu twice: in the user's UI language (sidebar,
 * picker, Excel headers) and in the institution print language (the printed
 * page's title and column headers) - see ReportShell's `printReports`.
 */
export const useLocalizedReports = (build: ReportBuilder) => {
  const isMadrasa = useIsMadrasa();
  const t = useText(reportsText);
  const col = useText(reportText).col;
  const pt = usePrintText(reportsText);
  const pcol = usePrintText(reportText).col;

  const reports = useMemo(() => applyColumnDefaults(build(t, col, isMadrasa), col), [build, t, col, isMadrasa]);
  const printReports = useMemo(() => applyColumnDefaults(build(pt, pcol, isMadrasa), pcol), [build, pt, pcol, isMadrasa]);
  return { reports, printReports, t };
};
