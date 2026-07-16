import DataExportPrintActions from "../common/DataExportPrintActions";
import {
  ClassItem,
  Division,
  ReportColumn,
  ReportMenuItem,
} from "../../../src/features/reports/types";

type ReportFilterBarProps = {
  search: string;
  selectedDivision: string;
  selectedClass: string;
  divisions: Division[];
  classes: ClassItem[];
  activeReport: ReportMenuItem;
  exportColumns: ReportColumn[];
  exportRows: Record<string, any>[];
  onSearchChange: (value: string) => void;
  onDivisionChange: (value: string) => void;
  onClassChange: (value: string) => void;
  onClear: () => void;
};

const ReportFilterBar = ({
  search,
  selectedDivision,
  selectedClass,
  divisions,
  classes,
  activeReport,
  exportColumns,
  exportRows,
  onSearchChange,
  onDivisionChange,
  onClassChange,
  onClear,
}: ReportFilterBarProps) => {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="ID / নাম / মোবাইল"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full sm:w-[240px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600"
        />

        <select
          value={selectedDivision}
          onChange={(e) => onDivisionChange(e.target.value)}
          className="h-10 w-full sm:w-[150px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600"
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
          className="h-10 w-full sm:w-[165px] rounded-lg border border-slate-200 px-3 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-600"
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
      />
    </div>
  );
};

export default ReportFilterBar;
