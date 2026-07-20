import { useEffect, useMemo, useState } from "react";
import api, { cachedGet } from "../../services/api";
import PaginatedReportPreview from "../../components/Report/PaginatedReportPreview";
import { Orientation, PaperSize } from "../../components/common/DataExportPrintActions";
import ReportFilterBar from "../../components/Report/ReportFilterBar";
import ReportSidebar from "../../components/Report/ReportSidebar";
import { ClassItem, Division, ExamItem, ReportColumn, ReportShellProps } from "./types";
import { getRowClassId, getRowDivisionId } from "../../utils/reportUtils";
import { logger } from "../../utils/logger";

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
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const activeReport = useMemo(
    () => reports.find((item) => item.key === activeKey) || reports[0],
    [activeKey, reports],
  );

  const loadReport = async () => {
    if (!activeReport?.endpoint) return;

    try {
      setLoading(true);
      setWarning("");

      if (activeReport.requiresExam && !selectedExam) {
        setRows([]);
        setWarning("পরীক্ষা নির্বাচন করুন");
        return;
      }

      const query = activeReport.requiresExam ? `?exam_id=${selectedExam}` : "";
      const res = await cachedGet(`${activeReport.endpoint}${query}`);
      const data =
        res.data?.data || res.data?.students || res.data?.teachers || res.data?.result || [];

      setRows(Array.isArray(data) ? data : []);
      setWarning(res.data?.warning || "");
    } catch (error: any) {
      logger.error("REPORT LOAD ERROR:", error);
      setRows([]);
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
    setOrientation(activeReport.defaultOrientation || "portrait");
  }, [activeKey, activeReport.defaultOrientation]);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, selectedExam]);

  const filteredRows = rows.filter((row) => {
    const keyword = search.trim().toLowerCase();
    const rowDivisionId = String(getRowDivisionId(row));
    const rowClassId = String(getRowClassId(row));

    const searchableText = [
      row.id,
      row.student_id,
      row.roll,
      row.teacher_id,
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
      row.exam_year,
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!keyword || searchableText.includes(keyword)) &&
      (!selectedDivision || rowDivisionId === String(selectedDivision)) &&
      (!selectedClass || rowClassId === String(selectedClass))
    );
  });

  const selectedDivisionName =
    divisions.find((division) => String(division.division_id) === String(selectedDivision))
      ?.division_name_bn || "";

  const selectedClassName =
    classes.find((cls) => String(cls.class_id) === String(selectedClass))?.class_name_bn || "";

  let exportRows = filteredRows;
  let exportColumns: ReportColumn[] = activeReport.columns;

  if (activeReport.printable === "academic-result") {
    const subjectMap = new Map<string, { key: string; name: string }>();

    filteredRows.forEach((row) => {
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

    exportRows = filteredRows.map((row) => {
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
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-4 md:p-6">
      <div className="no-print mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          {accentTitle}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">{pageSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
        <ReportSidebar reports={reports} activeKey={activeReport.key} onChange={setActiveKey} />

        <main className="overflow-hidden border border-slate-300 bg-white">
          <div className="no-print border-b border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{activeReport.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">{activeReport.subtitle}</p>
              </div>

              <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                মোট <span className="font-bold text-slate-900">{filteredRows.length}</span> টি
                রেকর্ড
              </div>
            </div>

            <ReportFilterBar
              search={search}
              selectedDivision={selectedDivision}
              selectedClass={selectedClass}
              selectedExam={selectedExam}
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
              }}
              onClassChange={setSelectedClass}
              onExamChange={setSelectedExam}
              onClear={clearFilters}
              paperSize={paperSize}
              orientation={orientation}
              onPaperSizeChange={setPaperSize}
              onOrientationChange={setOrientation}
            />

            {warning && (
              <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {warning}
              </div>
            )}
          </div>

          <div className="print-preview-wrap">
            <PaginatedReportPreview
              loading={loading}
              report={activeReport}
              rows={filteredRows}
              selectedDivisionName={selectedDivisionName}
              selectedClassName={selectedClassName}
              hideBrandHeader={hideBrandHeader}
              paperSize={paperSize}
              orientation={orientation}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportShell;
