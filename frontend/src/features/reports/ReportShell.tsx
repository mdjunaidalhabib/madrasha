import { useEffect, useMemo, useState } from "react";
import api, { cachedGet } from "../../services/api";
import PaginatedReportPreview from "../../components/Report/PaginatedReportPreview";
import { Orientation, PaperSize, PageMargins } from "../../components/common/DataExportPrintActions";
import { getDefaultPageMargins } from "../../components/Report/pagination/pageGeometry";
import ReportFilterBar from "../../components/Report/ReportFilterBar";
import ReportSidebar from "../../components/Report/ReportSidebar";
import { ClassItem, Division, ExamItem, ReportColumn, ReportShellProps } from "./types";
import { getRowClassId, getRowDivisionId } from "../../utils/reportUtils";
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
}: ReportShellProps) => {
  const [activeKey, setActiveKey] = useState(reports[0]?.key || "");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState("");

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
  // endpoint understands division_id/class_id/page/page_size - every other
  // report keeps filtering client-side only, exactly as before.
  const isPaginatedAcademicResult = activeReport.printable === "academic-result";

  const loadReport = async () => {
    if (!activeReport?.endpoint) return;

    try {
      setLoading(true);
      setWarning("");

      if (activeReport.requiresExam && !selectedExam) {
        setRows([]);
        setTotalCount(0);
        setWarning("পরীক্ষা নির্বাচন করুন");
        return;
      }

      const params = new URLSearchParams();
      if (activeReport.requiresExam) params.set("exam_id", selectedExam);
      if (activeReport.extraParams) {
        Object.entries(activeReport.extraParams).forEach(([key, value]) => params.set(key, value));
      }
      if (isPaginatedAcademicResult) {
        if (selectedDivision) params.set("division_id", selectedDivision);
        if (selectedClass) params.set("class_id", selectedClass);
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
      }
      const query = params.toString();
      const res = await cachedGet(`${activeReport.endpoint}${query ? `?${query}` : ""}`);
      const data =
        res.data?.data || res.data?.students || res.data?.teachers || res.data?.result || [];

      setRows(Array.isArray(data) ? data : []);
      setTotalCount(
        typeof res.data?.total === "number" ? res.data.total : Array.isArray(data) ? data.length : 0,
      );
      setWarning(res.data?.warning || "");
    } catch (error: any) {
      logger.error("REPORT LOAD ERROR:", error);
      setRows([]);
      setTotalCount(0);
      setWarning(error?.response?.data?.message || "রিপোর্ট লোড করা যায়নি");
    } finally {
      setLoading(false);
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
      const res = await cachedGet("/exams");
      const data = res.data?.data || res.data?.result || res.data || [];
      const examRows = Array.isArray(data) ? data : [];
      setExams(examRows);
      if (!selectedExam && examRows.length) setSelectedExam(String(examRows[0].id));
    } catch {
      setExams([]);
    }
  };

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");

    if (!divisionId) {
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

  // Non-paginated reports only ever need to refetch on activeKey/selectedExam
  // change (division/class stay client-side filters). The paginated academic
  // -result reports also refetch on division/class/page/pageSize, since
  // those are now sent to the server - folded into one string so the effect
  // fires exactly once per meaningful change instead of racing two effects.
  const loadTrigger = isPaginatedAcademicResult
    ? `${activeKey}|${selectedExam}|${selectedDivision}|${selectedClass}|${page}|${pageSize}`
    : `${activeKey}|${selectedExam}`;

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrigger]);

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

  const filteredRows = rows.filter((row) => {
    const keyword = search.trim().toLowerCase();
    const rowDivisionId = String(getRowDivisionId(row));
    const rowClassId = String(getRowClassId(row));

    // Kept as two separate buckets instead of one joined string - id/roll
    // are plain English-digit numbers, so a Bangla name search must never
    // accidentally match them (or vice versa) just because they happened to
    // sit next to each other in a combined string.
    const idFields = [
      row.id,
      row.student_id,
      row.roll,
      row.teacher_id,
      row.registration_no,
      row.exam_year,
    ]
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value) => String(value).toLowerCase());

    const searchableText = [
      row.name,
      row.name_bn,
      row.student_name,
      row.teacher_name,
      row.father_name,
      row.mother_name,
      row.guardian_phone,
      row.mobile,
      row.phone,
      row.class_name,
      row.division_name,
      row.exam_name,
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesKeyword =
      !keyword ||
      searchableText.includes(keyword) ||
      idFields.some((value) => value.includes(keyword));

    return (
      matchesKeyword &&
      (!selectedDivision || rowDivisionId === String(selectedDivision)) &&
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

  const totalRecords = isPaginatedAcademicResult ? totalCount : filteredRows.length;
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalCount);
  const hasPrevPage = page > 1;
  const hasNextPage = page * pageSize < totalCount;

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-2 dark:bg-slate-950 sm:p-4 lg:p-6">
      <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mb-5 sm:p-5">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
          {accentTitle}
        </div>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{pageTitle}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pageSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
        <ReportSidebar reports={reports} activeKey={activeReport.key} onChange={setActiveKey} />

        <main className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="no-print border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
                  {activeReport.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{activeReport.subtitle}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:px-4">
                  মোট <span className="font-bold text-slate-900 dark:text-slate-100">{totalRecords}</span> টি
                  রেকর্ড
                </div>

                {isPaginatedAcademicResult && totalCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {[50, 100, 200, 500].map((size) => (
                        <option key={size} value={size}>
                          {size} জন/পেজ
                        </option>
                      ))}
                    </select>

                    <span className="text-xs">
                      {pageStart}–{pageEnd}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!hasPrevPage}
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      আগের
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!hasNextPage}
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
                    >
                      পরের
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ReportFilterBar
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
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportShell;
