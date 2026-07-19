import DataExportPrintActions, { Orientation, PaperSize } from "../common/DataExportPrintActions";
import {
  ClassItem,
  Division,
  ExamItem,
  ReportColumn,
  ReportMenuItem,
} from "../../../src/features/reports/types";

type ReportFilterBarProps = {
  search: string;
  selectedDivision: string;
  selectedClass: string;
  selectedExam: string;
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
  onClear: () => void;
  paperSize: PaperSize;
  orientation: Orientation;
  onPaperSizeChange: (value: PaperSize) => void;
  onOrientationChange: (value: Orientation) => void;
};

const ReportFilterBar = ({
  search,
  selectedDivision,
  selectedClass,
  selectedExam,
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
  onClear,
  paperSize,
  orientation,
  onPaperSizeChange,
  onOrientationChange,
}: ReportFilterBarProps) => {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="ID / নাম / মোবাইল"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600 sm:w-[240px]"
        />

        {activeReport.requiresExam && (
          <select
            value={selectedExam}
            onChange={(e) => onExamChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600 sm:w-[190px]"
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
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600 sm:w-[150px]"
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
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 sm:w-[165px]"
        >
          <option value="">{selectedDivision ? "সকল শ্রেণি" : "আগে বিভাগ নির্বাচন"}</option>
          {classes.map((cls) => (
            <option key={cls.class_id} value={cls.class_id}>
              {cls.class_name_bn}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onClear}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
      />
    </div>
  );
};

export default ReportFilterBar;
