import { Link } from "react-router-dom";
import { Search, Settings2, X } from "lucide-react";
import DataExportPrintActions, {
  Orientation,
  PaperSize,
  PageMargins,
  ServerPdfExportConfig,
} from "../common/DataExportPrintActions";
import {
  ClassItem,
  Division,
  ExamItem,
  ReportColumn,
  ReportMenuItem,
} from "../../../src/features/reports/types";
import type { TemplateListItemDto } from "../../services/documentTemplateLibraryApi";
import { getTenantAdminBase } from "../../utils/tenantSlug";

const fieldClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-blue-900/40 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500";

type ReportFilterBarProps = {
  showSearch?: boolean;
  serverPdfExport?: ServerPdfExportConfig;
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
  divisionRequired?: boolean;
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
  showSearch = false,
  serverPdfExport,
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
  divisionRequired = false,
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
    <div className="no-print flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {showSearch && (
          <div className="relative w-full min-w-[150px] flex-1 sm:w-auto sm:flex-none sm:basis-[170px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ID / নাম / মোবাইল"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`${fieldClass} pl-6`}
            />
          </div>
        )}

        {activeReport.requiresExam && (
          <select
            value={selectedExam}
            onChange={(e) => onExamChange(e.target.value)}
            className={`${fieldClass} min-w-[130px] flex-1 sm:w-auto sm:flex-none`}
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
          className={`${fieldClass} min-w-[100px] flex-1 sm:w-auto sm:flex-none`}
        >
          <option value="">{divisionRequired ? "বিভাগ নির্বাচন করুন" : "সকল বিভাগ"}</option>
          {divisionRequired && <option value="all">সকল বিভাগ</option>}
          {divisions.map((division) => (
            <option key={division.division_id} value={division.division_id}>
              {division.division_name_bn}
            </option>
          ))}
        </select>

        {/* Teacher rows carry no class_id (teachers belong to a division, not
            a single class) - selecting a class would silently filter every
            row out, so this control just never shows for those two report
            types. */}
        {activeReport.printable !== "teacher-list" && activeReport.printable !== "teacher-phone-list" && (
          <select
            value={selectedClass}
            onChange={(e) => onClassChange(e.target.value)}
            disabled={!selectedDivision || selectedDivision === "all"}
            className={`${fieldClass} min-w-[100px] flex-1 sm:w-auto sm:flex-none`}
          >
            <option value="">
              {selectedDivision && selectedDivision !== "all" ? "সকল শ্রেণি" : "আগে বিভাগ নির্বাচন"}
            </option>
            {classes.map((cls) => (
              <option key={cls.class_id} value={cls.class_id}>
                {cls.class_name_bn}
              </option>
            ))}
          </select>
        )}

        {activeReport.hasSubjectFilter && (
          <select
            value={selectedSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            disabled={!selectedClass}
            className={`${fieldClass} min-w-[100px] flex-1 sm:w-auto sm:flex-none`}
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
            className={`${fieldClass} min-w-[130px] flex-1 sm:w-auto sm:flex-none`}
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
            className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
          >
            <Settings2 className="h-3 w-3" />
            টেমপ্লেট
          </Link>
        )}

        {(search || selectedDivision || selectedClass || selectedSubject) && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2 text-[13px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-3 w-3" />
            মুছুন
          </button>
        )}
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
        serverPdfExport={serverPdfExport}
      />
    </div>
  );
};

export default ReportFilterBar;
