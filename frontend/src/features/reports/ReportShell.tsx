import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { cachedGet } from "../../services/api";
import PaginatedReportPreview from "../../components/Report/PaginatedReportPreview";
import { Orientation, PaperSize, PageMargins } from "../../components/common/DataExportPrintActions";
import { getDefaultPageMargins } from "../../components/Report/pagination/pageGeometry";
import ReportFilterBar from "../../components/Report/ReportFilterBar";
import ReportSidebar from "../../components/Report/ReportSidebar";
import { ClassItem, Division, ExamItem, ReportColumn, ReportShellProps } from "./types";
import { getRowClassId, getRowDivisionId } from "../../utils/reportUtils";
import { filterPeopleBySearch } from "../../utils/personSearch";
import { logger } from "../../utils/logger";
import { listTemplates, type TemplateListItemDto } from "../../services/documentTemplateLibraryApi";
import { useSelectedTemplateOverrideStore } from "../../store/selectedTemplateOverrideStore";

export type { ReportColumn, ReportMenuItem } from "./types";

type ReportSubject = {
  book_id?: number | string;
  subject_name?: string;
  mark?: number | string | null;
};

const getReportSubjects = (row: Record<string, any>): ReportSubject[] => {
  const subjects = row?.subjects;
  if (Array.isArray(subjects)) return subjects;

  if (typeof subjects === "string") {
    try {
      const parsed = JSON.parse(subjects);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const ReportShell = ({
  pageTitle,
  pageSubtitle,
  accentTitle,
  reports,
  hideBrandHeader = false,
  showSearch = false,
  reportsPageKey,
  printMode = false,
}: ReportShellProps) => {
  const [searchParams] = useSearchParams();
  // In print mode the active report comes from the URL (?key=...) rather
  // than defaulting to the first menu item - set directly in initial state
  // (not an effect) so it's correct on the very first render and the
  // "reset filters on activeKey change" effect below never sees activeKey
  // change again after mount, which would otherwise wipe out the
  // division/class/orientation values the hydration effect further down
  // sets.
  const [activeKey, setActiveKey] = useState(
    (printMode && searchParams.get("key")) || reports[0]?.key || "",
  );
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  // Starts true (rather than waiting for the first loadReport() call to flip
  // it) so the very first paint shows the loading skeleton instead of
  // briefly flashing the "কোনো ডাটা পাওয়া যায়নি" empty state before any
  // fetch has even had a chance to run.
  const [loading, setLoading] = useState(true);
  const [examsLoaded, setExamsLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  // Print mode hydrates its filters (division/class/exam/...) from the URL
  // in an effect below - false until that finishes (including its async
  // loadClassesByDivision leg), so the data-fetch effect never fires on the
  // pre-hydration "no division selected" state first. See that effect's own
  // comment for the empty-PDF bug this was causing. Non-print mode has
  // nothing to hydrate, so it starts (and stays) true.
  const [hydrated, setHydrated] = useState(!printMode);

  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margins, setMargins] = useState<PageMargins>(() => getDefaultPageMargins("a4"));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [templates, setTemplates] = useState<TemplateListItemDto[]>([]);
  const selectedTemplateId = useSelectedTemplateOverrideStore((s) => s.templateId);
  const setSelectedTemplateId = useSelectedTemplateOverrideStore((s) => s.setTemplateId);

  const activeReport = useMemo(
    () => reports.find((item) => item.key === activeKey) || reports[0],
    [activeKey, reports],
  );

  // The "ফলাফল" / "ফলাফল (মেধাক্রম অনুযায়ী)" reports are the only ones whose
  // endpoint understands page/page_size - every other report keeps loading
  // its whole (division/class-narrowed) result set in one shot, exactly as
  // before.
  const isPaginatedAcademicResult = activeReport.printable === "academic-result";
  // Reports flagged requiresDivision (academic-result/result-notice/class
  // -routine) can return a heavy, mostly-wasted payload with no division
  // filter - see ReportMenuItem.requiresDivision.
  const divisionRequired = !!activeReport.requiresDivision;
  // On "ডকুমেন্ট সমূহ" (showSearch=true), the ID/নাম/মোবাইল box exists
  // specifically to find one student without knowing their division/class
  // first - so an active search bypasses the "pick a division" gate below
  // and falls back to fetching the full (unfiltered) roster, exactly like
  // before requiresDivision existed. Boolean, not the raw text, so typing
  // more characters doesn't retrigger the fetch effect on every keystroke -
  // narrowing further is still handled client-side by filteredRows.
  const hasSearchQuery = search.trim().length > 0;

  // Guards against an older, slower loadReport() call resolving AFTER a
  // newer one (production network jitter makes this far more likely than
  // it seems in dev) and clobbering fresh rows with a stale/empty result -
  // every setRows/setWarning/setLoading below only applies if this call is
  // still the most recent one by the time it gets there.
  const loadRequestIdRef = useRef(0);

  const loadReport = async () => {
    if (!activeReport?.endpoint) return;
    const requestId = ++loadRequestIdRef.current;
    const isCurrent = () => requestId === loadRequestIdRef.current;

    try {
      setLoading(true);
      setWarning("");

      if (activeReport.requiresExam && !selectedExam) {
        if (isCurrent()) {
          setRows([]);
          setTotalCount(0);
          setWarning("পরীক্ষা নির্বাচন করুন");
        }
        return;
      }

      if (divisionRequired && !selectedDivision && !hasSearchQuery) {
        if (isCurrent()) {
          setRows([]);
          setTotalCount(0);
          setWarning("বিভাগ নির্বাচন করুন");
        }
        return;
      }

      const params = new URLSearchParams();
      if (activeReport.requiresExam) params.set("exam_id", selectedExam);
      if (activeReport.extraParams) {
        Object.entries(activeReport.extraParams).forEach(([key, value]) => params.set(key, value));
      }
      if (divisionRequired) {
        if (selectedDivision && selectedDivision !== "all") params.set("division_id", selectedDivision);
        if (selectedClass) params.set("class_id", selectedClass);
      }
      if (isPaginatedAcademicResult) {
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
      }
      const query = params.toString();
      const res = await cachedGet(`${activeReport.endpoint}${query ? `?${query}` : ""}`);
      if (!isCurrent()) return;

      const data =
        res.data?.data || res.data?.students || res.data?.teachers || res.data?.result || [];

      setRows(Array.isArray(data) ? data : []);
      setTotalCount(
        typeof res.data?.total === "number" ? res.data.total : Array.isArray(data) ? data.length : 0,
      );
      setWarning(res.data?.warning || "");
    } catch (error: any) {
      logger.error("REPORT LOAD ERROR:", error);
      if (isCurrent()) {
        setRows([]);
        setTotalCount(0);
        setWarning(error?.response?.data?.message || "রিপোর্ট লোড করা যায়নি");
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  const loadDivisions = async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      const data = res.data?.data || res.data?.result || res.data || [];
      setDivisions(Array.isArray(data) ? data : []);
    } catch {
      setDivisions([]);
    }
  };

  const loadExams = async () => {
    try {
      const res = await cachedGet("/exams", { params: { active_only: true } });
      const data = res.data?.data || res.data?.result || res.data || [];
      const examRows = Array.isArray(data) ? data : [];
      setExams(examRows);
      if (!selectedExam && examRows.length) setSelectedExam(String(examRows[0].id));
    } catch {
      setExams([]);
    } finally {
      setExamsLoaded(true);
    }
  };

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");

    if (!divisionId || divisionId === "all") {
      setClasses([]);
      return;
    }

    try {
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      const data = res.data?.data || res.data?.result || res.data || [];
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    loadDivisions();
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearch("");
    setSelectedDivision("");
    setSelectedClass("");
    setClasses([]);
    setSelectedSubject("");
    setPage(1);
    setOrientation(activeReport.defaultOrientation || "portrait");
    setSelectedTemplateId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeReport.defaultOrientation]);

  useEffect(() => {
    setMargins(getDefaultPageMargins(paperSize));
  }, [paperSize]);

  // Print-mode only, runs once on mount: hydrates the filter state a headless
  // browser can't set by clicking through the UI, straight from the URL
  // query string the backend export service builds (see
  // report-export.service.ts). Deliberately skips margins - the print route
  // just uses that paper size's defaults (getDefaultPageMargins above),
  // matching what a fresh visit would compute anyway, so there's no need to
  // thread margin_top/right/bottom/left through the URL too.
  useEffect(() => {
    if (!printMode) return;

    const examId = searchParams.get("exam_id");
    if (examId) setSelectedExam(examId);

    const subject = searchParams.get("subject");
    if (subject) setSelectedSubject(subject);

    const templateId = searchParams.get("template_id");
    if (templateId) setSelectedTemplateId(Number(templateId));

    const paperSizeParam = searchParams.get("paper_size");
    if (paperSizeParam === "a4" || paperSizeParam === "a5") setPaperSize(paperSizeParam);

    const orientationParam = searchParams.get("orientation");
    if (orientationParam === "portrait" || orientationParam === "landscape") {
      setOrientation(orientationParam);
    }

    const divisionId = searchParams.get("division_id");
    const classId = searchParams.get("class_id");
    if (divisionId) {
      setSelectedDivision(divisionId);
      loadClassesByDivision(divisionId).then(() => {
        if (classId) setSelectedClass(classId);
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printMode]);

  // A requiresDivision report also refetches on division/class change, since
  // those are sent to the server as real filters now - the paginated
  // academic-result ones additionally refetch on page/pageSize, and
  // hasSearchQuery re-triggers the one fetch a bypassed-gate search needs
  // (see hasSearchQuery above). Folded into one string so the effect fires
  // exactly once per meaningful change instead of racing two effects.
  const loadTrigger = divisionRequired
    ? `${activeKey}|${selectedExam}|${selectedDivision}|${selectedClass}|${hasSearchQuery}|${isPaginatedAcademicResult ? `${page}|${pageSize}` : ""}`
    : `${activeKey}|${selectedExam}`;

  useEffect(() => {
    // Print mode: don't fire on the pre-hydration state (selectedDivision
    // etc still "") - the URL-hydration effect above hasn't set the real
    // filters yet at the moment this effect first runs, since its own
    // loadClassesByDivision leg is async. Without this guard, a
    // divisionRequired report's early "no division picked" branch in
    // loadReport() sets loading:false with empty rows almost instantly,
    // which is indistinguishable from a genuinely-empty report to
    // PaginatedReportPreview's data-report-ready attribute - so the
    // server-side PDF export's headless browser can capture the PDF right
    // in that window, producing a page with the report's structure but no
    // data. See the loadRequestIdRef guard in loadReport() for the other
    // half of this fix (an in-flight stale request finishing late).
    if (printMode && !hydrated) return;

    // For an exam-requiring report, loadExams() auto-selects the first exam
    // once it resolves - but that's a separate async call from this effect,
    // so on mount selectedExam is still "" for a moment even though an exam
    // will shortly be picked. Loading report data before exams have finished
    // loading would wrongly conclude "no exam selected" and flash the
    // "পরীক্ষা নির্বাচন করুন" warning before the real exam (and its data) ever
    // gets a chance to load - so just wait for that first exams response.
    if (activeReport.requiresExam && !selectedExam && !examsLoaded) return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrigger, examsLoaded, hydrated]);

  useEffect(() => {
    const documentType = activeReport.documentType;
    if (!documentType) {
      setTemplates([]);
      return;
    }

    let cancelled = false;
    listTemplates(documentType)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeReport.documentType]);

  // Subjects/books are tied to a class (see reports.repository.ts's
  // `b.class_id = s.class_id` join), so listing every subject across ALL
  // loaded classes at once would jumble together books that don't even
  // belong to the same jamat. Scoped to selectedClass instead - empty until
  // a class is picked, matching how the শ্রেণি select itself stays empty
  // until a division is picked.
  const subjectOptions = useMemo(() => {
    if (!activeReport.hasSubjectFilter || !selectedClass) return [];
    const map = new Map<string, string>();
    rows
      .filter((row) => String(getRowClassId(row)) === String(selectedClass))
      .forEach((row) => {
        getReportSubjects(row).forEach((subject, index) => {
          const key = String(subject.book_id ?? subject.subject_name ?? index);
          if (!map.has(key)) map.set(key, subject.subject_name || `বিষয় ${index + 1}`);
        });
      });
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [rows, activeReport.hasSubjectFilter, selectedClass]);

  const searchedRows = filterPeopleBySearch(rows, search, (row) => ({
    text: [
      row.name,
      row.name_bn,
      row.student_name,
      row.teacher_name,
      row.father_name,
      row.mother_name,
      row.class_name,
      row.division_name,
      row.exam_name,
      row.status,
    ],
    registrationNo: row.registration_no,
    phones: [row.guardian_phone, row.mobile, row.phone],
  }));

  const filteredRows = searchedRows.filter((row) => {
    const rowDivisionId = String(getRowDivisionId(row));
    const rowClassId = String(getRowClassId(row));
    return (
      (!selectedDivision || selectedDivision === "all" || rowDivisionId === String(selectedDivision)) &&
      (!selectedClass || rowClassId === String(selectedClass))
    );
  });

  if (activeReport.printable === "teacher-list" || activeReport.printable === "teacher-phone-list") {
    filteredRows.sort(
      (a, b) => (Number(a.registration_no) || 0) - (Number(b.registration_no) || 0),
    );
  }

  const selectedDivisionName =
    divisions.find((division) => String(division.division_id) === String(selectedDivision))
      ?.division_name_bn || "";

  const selectedClassName =
    classes.find((cls) => String(cls.class_id) === String(selectedClass))?.class_name_bn || "";

  // When a single subject is picked, narrow every row's `subjects` array down
  // to just that one before it reaches the print preview or the CSV/Excel
  // export builder below - students stay in the list, only their subject
  // columns shrink to the one selected.
  const displayRows: Record<string, any>[] =
    activeReport.hasSubjectFilter && selectedSubject
      ? filteredRows.map((row) => ({
          ...row,
          subjects: getReportSubjects(row).filter(
            (subject, index) =>
              String(subject.book_id ?? subject.subject_name ?? index) === selectedSubject,
          ),
        }))
      : filteredRows;

  let exportRows = displayRows;
  let exportColumns: ReportColumn[] = activeReport.columns;

  if (activeReport.printable === "academic-result") {
    const subjectMap = new Map<string, { key: string; name: string }>();

    displayRows.forEach((row) => {
      getReportSubjects(row).forEach((subject, index) => {
        const subjectId = String(subject.book_id ?? subject.subject_name ?? index);
        const key = `subject_${subjectId}`;
        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            key,
            name: subject.subject_name || `বিষয় ${index + 1}`,
          });
        }
      });
    });

    const subjectColumns: ReportColumn[] = Array.from(subjectMap.values()).map((subject) => ({
      header: subject.name,
      key: subject.key,
    }));
    const totalColumnIndex = activeReport.columns.findIndex((column) => column.key === "total");

    exportColumns =
      totalColumnIndex >= 0
        ? [
            ...activeReport.columns.slice(0, totalColumnIndex),
            ...subjectColumns,
            ...activeReport.columns.slice(totalColumnIndex),
          ]
        : [...activeReport.columns, ...subjectColumns];

    exportRows = displayRows.map((row) => {
      const flattenedRow = { ...row };
      getReportSubjects(row).forEach((subject, index) => {
        const subjectId = String(subject.book_id ?? subject.subject_name ?? index);
        flattenedRow[`subject_${subjectId}`] =
          subject.mark === null || subject.mark === undefined ? "" : subject.mark;
      });
      return flattenedRow;
    });
  }

  const clearFilters = () => {
    setSearch("");
    setSelectedDivision("");
    setSelectedClass("");
    setClasses([]);
    setSelectedSubject("");
    setPage(1);
  };

  // Computed directly from filter state (not the async `warning` set inside
  // loadReport) so the preview shows the right guidance the instant a report
  // with no rows renders, rather than flashing the generic "কোনো ডাটা পাওয়া
  // যায়নি" text until the fetch effect catches up.
  const previewEmptyMessage = activeReport.requiresExam && !selectedExam
    ? "রিপোর্ট দেখতে উপর থেকে পরীক্ষা নির্বাচন করুন"
    : divisionRequired && !selectedDivision && !hasSearchQuery
      ? "রিপোর্ট দেখতে বিভাগ নির্বাচন করুন (প্রয়োজনে শ্রেণিও নির্বাচন করতে পারেন)"
      : warning || undefined;

  const totalRecords = isPaginatedAcademicResult ? totalCount : filteredRows.length;
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalCount);
  const hasPrevPage = page > 1;
  const hasNextPage = page * pageSize < totalCount;

  // Built once here (not inside DataExportPrintActions) since this is the
  // one place that already has every filter value the print route needs to
  // reproduce this exact view - see ReportShell's printMode hydration effect
  // above for the other end of this contract.
  const serverPdfExport = {
    reportsPage: reportsPageKey,
    reportKey: activeReport.key,
    filters: {
      exam_id: selectedExam || undefined,
      division_id: selectedDivision || undefined,
      class_id: selectedClass || undefined,
      subject: selectedSubject || undefined,
      template_id: selectedTemplateId ? String(selectedTemplateId) : undefined,
    },
  };

  // Chrome-less: no sidebar/filter-bar/page header, nothing that isn't the
  // report itself - this is what the headless browser (server-side PDF
  // export) actually screenshots/prints. See PaginatedReportPreview's
  // data-report-ready attribute for how it signals "done rendering" back to
  // that headless browser.
  if (printMode) {
    return (
      <PaginatedReportPreview
        loading={loading}
        report={activeReport}
        rows={displayRows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        hideBrandHeader={hideBrandHeader}
        paperSize={paperSize}
        orientation={orientation}
        margins={margins}
        emptyMessage={previewEmptyMessage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-2 dark:bg-slate-950 sm:p-4 lg:p-6">
      {(accentTitle || pageTitle || pageSubtitle) && (
        <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mb-5 sm:p-5">
          {accentTitle && (
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
              {accentTitle}
            </div>
          )}
          {pageTitle && (
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{pageTitle}</h1>
          )}
          {pageSubtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pageSubtitle}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
        <ReportSidebar reports={reports} activeKey={activeReport.key} onChange={setActiveKey} />

        <main className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="no-print border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  {activeReport.title}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{activeReport.subtitle}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:text-[13px]">
                  মোট <span className="font-bold text-slate-900 dark:text-slate-100">{totalRecords}</span> টি
                  রেকর্ড
                </div>

                {isPaginatedAcademicResult && totalCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {[50, 100, 200, 500].map((size) => (
                        <option key={size} value={size}>
                          {size} জন/পেজ
                        </option>
                      ))}
                    </select>

                    <span className="whitespace-nowrap text-xs">
                      {pageStart}–{pageEnd}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!hasPrevPage}
                      className="h-7 rounded border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      আগের
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!hasNextPage}
                      className="h-7 rounded border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      পরের
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ReportFilterBar
              showSearch={showSearch}
              serverPdfExport={serverPdfExport}
              search={search}
              selectedDivision={selectedDivision}
              selectedClass={selectedClass}
              selectedExam={selectedExam}
              selectedSubject={selectedSubject}
              subjectOptions={subjectOptions}
              divisions={divisions}
              classes={classes}
              exams={exams}
              activeReport={activeReport}
              divisionRequired={divisionRequired}
              exportColumns={exportColumns}
              exportRows={exportRows}
              onSearchChange={setSearch}
              onDivisionChange={(value) => {
                setSelectedDivision(value);
                loadClassesByDivision(value);
                setSelectedSubject("");
                setPage(1);
              }}
              onClassChange={(value) => {
                setSelectedClass(value);
                setSelectedSubject("");
                setPage(1);
              }}
              onExamChange={(value) => {
                setSelectedExam(value);
                setSelectedSubject("");
                setPage(1);
              }}
              onSubjectChange={setSelectedSubject}
              onClear={clearFilters}
              paperSize={paperSize}
              orientation={orientation}
              onPaperSizeChange={setPaperSize}
              onOrientationChange={setOrientation}
              margins={margins}
              onMarginsChange={setMargins}
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={setSelectedTemplateId}
            />

            {warning && (
              <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                {warning}
              </div>
            )}
          </div>

          <div className="print-preview-wrap">
            <PaginatedReportPreview
              loading={loading}
              report={activeReport}
              rows={displayRows}
              selectedDivisionName={selectedDivisionName}
              selectedClassName={selectedClassName}
              hideBrandHeader={hideBrandHeader}
              paperSize={paperSize}
              orientation={orientation}
              margins={margins}
              emptyMessage={previewEmptyMessage}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportShell;
