import { Link } from "react-router-dom";
import DataExportPrintActions, { Orientation, PaperSize, PageMargins } from "../common/DataExportPrintActions";
import {
  ClassItem,
  Division,
  ExamItem,
  ReportColumn,
  ReportMenuItem,
} from "../../../src/features/reports/types";
import type { TemplateListItemDto } from "../../services/documentTemplateLibraryApi";
import { getTenantAdminBase } from "../../utils/tenantSlug";

type ReportFilterBarProps = {
  search: string;
  selectedDivision: string;
  selectedClass: string;
  selectedExam: string;
  selectedSubject: string;
  subjectOptions: { key: string; name: string }[];
  divisions: Division[];
  classes: ClassItem[];
  exams: ExamItem[];
  activeReport: ReportMenuItem;
  exportColumns: ReportColumn[];
  exportRows: Record<string, any>[];
  onSearchChange: (value: string) => void;
  onDivisionChange: (value: string) => void;
  onClassChange: (value: string) => void;
  onExamChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onClear: () => void;
  paperSize: PaperSize;
  orientation: Orientation;
  onPaperSizeChange: (value: PaperSize) => void;
  onOrientationChange: (value: Orientation) => void;
  margins: PageMargins;
  onMarginsChange: (value: PageMargins) => void;
  templates: TemplateListItemDto[];
  selectedTemplateId: number | null;
  onTemplateChange: (value: number | null) => void;
};

const ReportFilterBar = ({
  search,
  selectedDivision,
  selectedClass,
  selectedExam,
  selectedSubject,
  subjectOptions,
  divisions,
  classes,
  exams,
  activeReport,
  exportColumns,
  exportRows,
  onSearchChange,
  onDivisionChange,
  onClassChange,
  onExamChange,
  onSubjectChange,
  onClear,
  paperSize,
  orientation,
  onPaperSizeChange,
  onOrientationChange,
  margins,
  onMarginsChange,
  templates,
  selectedTemplateId,
  onTemplateChange,
}: ReportFilterBarProps) => {
  return (
    <div className="no-print flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
        <input
          type="text"
          placeholder="ID / নাম / মোবাইল"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2 xl:w-[240px] xl:col-span-1"
        />

        {activeReport.requiresExam && (
          <select
            value={selectedExam}
            onChange={(e) => onExamChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 xl:w-[190px]"
          >
            <option value="">পরীক্ষা নির্বাচন করুন</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
                {exam.year ? ` (${exam.year})` : ""}
              </option>
            ))}
          </select>
        )}

        <select
          value={selectedDivision}
          onChange={(e) => onDivisionChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 xl:w-[150px]"
        >
          <option value="">সকল বিভাগ</option>
          {divisions.map((division) => (
            <option key={division.division_id} value={division.division_id}>
              {division.division_name_bn}
            </option>
          ))}
        </select>

        <select
          value={selectedClass}
          onChange={(e) => onClassChange(e.target.value)}
          disabled={!selectedDivision}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 xl:w-[165px]"
        >
          <option value="">{selectedDivision ? "সকল শ্রেণি" : "আগে বিভাগ নির্বাচন"}</option>
          {classes.map((cls) => (
            <option key={cls.class_id} value={cls.class_id}>
              {cls.class_name_bn}
            </option>
          ))}
        </select>

        {activeReport.hasSubjectFilter && (
          <select
            value={selectedSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            disabled={!selectedClass}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 xl:w-[165px]"
          >
            <option value="">{selectedClass ? "সকল বিষয়" : "আগে শ্রেণি নির্বাচন করুন"}</option>
            {subjectOptions.map((subject) => (
              <option key={subject.key} value={subject.key}>
                {subject.name}
              </option>
            ))}
          </select>
        )}

        {activeReport.documentType && (
          <select
            value={selectedTemplateId ?? ""}
            onChange={(e) => onTemplateChange(e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 xl:w-[170px]"
          >
            <option value="">ডিফল্ট (স্বয়ংক্রিয়)</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        )}

        {activeReport.documentType && (
          <Link
            to={`${getTenantAdminBase()}/talimat/settings/documents`}
            className="flex h-10 w-full items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-blue-950/40 xl:w-auto"
          >
            টেমপ্লেট ম্যানেজ করুন
          </Link>
        )}

        <button
          type="button"
          onClick={onClear}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 xl:w-auto"
        >
          Clear
        </button>
      </div>

      <DataExportPrintActions
        title={activeReport.title}
        columns={exportColumns}
        data={exportRows}
        fileName={activeReport.key}
        paperSize={paperSize}
        orientation={orientation}
        onPaperSizeChange={onPaperSizeChange}
        onOrientationChange={onOrientationChange}
        margins={margins}
        onMarginsChange={onMarginsChange}
      />
    </div>
  );
};

export default ReportFilterBar;
