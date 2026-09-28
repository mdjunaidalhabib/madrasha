import { useMemo } from "react";
import { useIsMadrasa, usePrintText, useText } from "@madrasha/shared-ui/src/i18n";
import { reportText, type ReportText } from "../../components/Report/report.text";
import { reportsText, type ReportsText } from "./reports.text";
import type { ReportMenuItem } from "./types";

export type ReportBuilder = (t: ReportsText, col: ReportText["col"], isMadrasa: boolean) => ReportMenuItem[];

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

  const reports = useMemo(() => build(t, col, isMadrasa), [build, t, col, isMadrasa]);
  const printReports = useMemo(() => build(pt, pcol, isMadrasa), [build, pt, pcol, isMadrasa]);
  return { reports, printReports, t };
};
