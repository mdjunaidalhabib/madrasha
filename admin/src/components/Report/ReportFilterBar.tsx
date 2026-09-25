import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, Settings2, X } from "lucide-react";
import DataExportPrintActions, {
  Orientation,
  PaperSize,
  PageMargins,
  ServerPdfExportConfig,
} from "../common/DataExportPrintActions";
import FilterSelect from "../common/FilterSelect";
import { getReportDefaultMargins } from "./pagination/pageGeometry";
import {
  ClassItem,
  Division,
  ExamItem,
  ReportColumn,
  ReportMenuItem,
} from "../../../src/features/reports/types";
import type { TemplateListItemDto } from "../../services/documentTemplateLibraryApi";
import {
  DEFAULT_ID_CARD_BACK_ID,
  getDefaultBuiltinBackDesign,
  listBuiltinBackDesigns,
  listBuiltinDesigns,
} from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";
import type { CardsPerPage } from "../../store/selectedTemplateOverrideStore";
import { MarksheetSettingsToggleButton } from "./student/MarksheetSignatureControls";
import { AdmitCardSettingsToggleButton } from "./documents/AdmitCardFieldControls";
import NoticeBoardPicker from "./documents/NoticeBoardPicker";

const fieldClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-blue-900/40 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500";
// Selects use FilterSelect (custom animated chevron) instead of the native
// arrow - appearance-none hides that, pr-5 keeps text clear of the icon.
const selectFieldClass = `${fieldClass} appearance-none pr-5`;
const selectIconClass =
  "pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-transform duration-200 dark:text-slate-500";

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
  cardsPerPage: CardsPerPage;
  onCardsPerPageChange: (value: CardsPerPage) => void;
  /** আইডি কার্ড: পিছনের পাতার ডিজাইন (null = পিছন ছাড়া)। */
  idCardBackId: number | null;
  onIdCardBackChange: (id: number | null) => void;
  /** আইডি কার্ড ("একক শিক্ষার্থী" মোড): সামনের সাথে একই পাতায় ছাপার পিছনের ডিজাইন (null = শুধু সামনে) */
  idCardPairBackId: number | null;
  onIdCardPairChange: (both: boolean) => void;
  /** "আইডি কার্ড ব্যাক" রিপোর্ট ("একক শিক্ষার্থী" মোড): পিছনের সাথে সামনেও ছাপা হবে কি না। */
  idCardBackWithFront: boolean;
  onIdCardBackWithFrontChange: (value: boolean) => void;
  /** Marksheet report only: whether the docked settings panel is open, and how to toggle it. */
  marksheetPanelOpen?: boolean;
  onMarksheetPanelToggle?: () => void;
  /** Admit-card report only: whether the docked field-settings panel is open, and how to toggle it. */
  admitCardPanelOpen?: boolean;
  onAdmitCardPanelToggle?: () => void;
  /** টুলবারের ২য় লাইনে পেজ সেটআপের পাশে বসে (যেমন কলাম মেনু, প্রতি পেজে হেডার টগল)। */
  setupExtras?: ReactNode;
  /** টুলবারের ২য় লাইনে এক্সপোর্ট বাটনের আগে বসে (যেমন পেজিনেশন)। */
  summary?: ReactNode;
};

// আইডি কার্ড / বই-লেবেলের পাতা-বিন্যাস অপশন - অন্য রিপোর্টে এই ড্রপডাউন দেখায় না।
// প্রবেশপত্র সবসময় স্বয়ংক্রিয় বিন্যাসে ছাপা হয় (দেখুন resolveCardsPerSheet) - আলাদা
// পছন্দের দরকার নেই, তাই ওই রিপোর্টে এই ড্রপডাউন নেই।
const CARD_LAYOUT_OPTIONS: Record<string, { value: CardsPerPage; label: string }[]> = {
  // "1" = একক শিক্ষার্থী (প্রতি পাতায় ১টি) - ডিফল্ট; "grid" = সকল শিক্ষার্থী (কাগজ ভাগ হয়ে একপাতায় অনেকগুলো)।
  "id-card": [
    { value: "1", label: "একক শিক্ষার্থী (পাতায় ১টি)" },
    { value: "grid", label: "সকল শিক্ষার্থী (পাতায় অনেকগুলো)" },
  ],
  // পুরস্কার বই-লেবেল: ডিফল্ট = পুরো কাগজে সব লেবেল, কাটার-রেখাসহ।
  "book-label": [
    { value: "auto", label: "সকল লেবেল (কাটার-রেখাসহ)" },
    { value: "1", label: "প্রতি পাতায় ১টি" },
  ],
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
  cardsPerPage,
  onCardsPerPageChange,
  idCardBackId,
  onIdCardBackChange,
  idCardPairBackId,
  onIdCardPairChange,
  idCardBackWithFront,
  onIdCardBackWithFrontChange,
  marksheetPanelOpen = false,
  onMarksheetPanelToggle,
  admitCardPanelOpen = false,
  onAdmitCardPanelToggle,
  setupExtras,
  summary,
}: ReportFilterBarProps) => {
  const builtinDesigns = activeReport.documentType ? listBuiltinDesigns(activeReport.documentType) : [];
  const cardLayoutOptions = activeReport.printable ? CARD_LAYOUT_OPTIONS[activeReport.printable] : undefined;

  return (
    <div className="no-print flex flex-col gap-2">
      {/* লাইন ১: কী দেখব - ডেটা ফিল্টার ও ডিজাইন বাছাই */}
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

        {activeReport.printable === "notice-board" && (
          <NoticeBoardPicker selectClassName={selectFieldClass} iconClassName={selectIconClass} />
        )}

        {activeReport.requiresExam && (
          <FilterSelect
            value={selectedExam}
            onChange={onExamChange}
            wrapperClassName="min-w-[130px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value="">পরীক্ষা নির্বাচন করুন</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
                {exam.year ? ` (${exam.year})` : ""}
              </option>
            ))}
          </FilterSelect>
        )}

        <FilterSelect
          value={selectedDivision}
          onChange={onDivisionChange}
          wrapperClassName="min-w-[100px] flex-1 sm:w-auto sm:flex-none"
          selectClassName={selectFieldClass}
          iconClassName={selectIconClass}
        >
          <option value="">{divisionRequired ? "বিভাগ নির্বাচন করুন" : "সকল বিভাগ"}</option>
          {divisions.map((division) => (
            <option key={division.division_id} value={division.division_id}>
              {division.division_name_bn}
            </option>
          ))}
          {divisionRequired && <option value="all">সকল বিভাগ</option>}
        </FilterSelect>

        {/* Teacher rows carry no class_id (teachers belong to a division, not
            a single class) - selecting a class would silently filter every
            row out, so this control just never shows for those two report
            types. */}
        {activeReport.printable !== "teacher-list" && activeReport.printable !== "teacher-phone-list" && (
          <FilterSelect
            value={selectedClass}
            onChange={onClassChange}
            disabled={!selectedDivision || selectedDivision === "all"}
            wrapperClassName="min-w-[100px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value="">
              {selectedDivision && selectedDivision !== "all"
                ? divisionRequired
                  ? "শ্রেণি নির্বাচন করুন"
                  : "সকল শ্রেণি"
                : "আগে বিভাগ নির্বাচন"}
            </option>
            {classes.map((cls) => (
              <option key={cls.class_id} value={cls.class_id}>
                {cls.class_name_bn}
              </option>
            ))}
            {divisionRequired && selectedDivision && selectedDivision !== "all" && (
              <option value="all">সকল শ্রেণি</option>
            )}
          </FilterSelect>
        )}

        {activeReport.hasSubjectFilter && (
          <FilterSelect
            value={selectedSubject}
            onChange={onSubjectChange}
            disabled={!selectedClass || selectedClass === "all"}
            wrapperClassName="min-w-[100px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value="">{selectedClass && selectedClass !== "all" ? "সকল বিষয়" : "আগে শ্রেণি নির্বাচন করুন"}</option>
            {subjectOptions.map((subject) => (
              <option key={subject.key} value={subject.key}>
                {subject.name}
              </option>
            ))}
          </FilterSelect>
        )}

        {/* সামনের ডিজাইন: আইডি কার্ড রিপোর্টে সবসময়; ব্যাক রিপোর্টে শুধু "দুই পাশ" বাছা থাকলে (একক শিক্ষার্থী মোড)। */}
        {activeReport.documentType && (!activeReport.backOnly || (idCardBackWithFront && cardsPerPage === "1")) && (
          <FilterSelect
            value={selectedTemplateId ?? ""}
            onChange={(value) => onTemplateChange(value ? Number(value) : null)}
            wrapperClassName="min-w-[130px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value="">ডিফল্ট (সাধারণ ডিজাইন)</option>
            {builtinDesigns.length > 0 && (
              <optgroup label="রেডিমেড ডিজাইন">
                {builtinDesigns.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name}
                  </option>
                ))}
              </optgroup>
            )}
            {templates.length > 0 && (
              <optgroup label="আমার / সিস্টেম টেমপ্লেট">
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </optgroup>
            )}
          </FilterSelect>
        )}

        {/* পিছনের ডিজাইন শুধু "আইডি কার্ড ব্যাক" রিপোর্টে বাছা যায় - আইডি কার্ড রিপোর্টে শুধু সামনের পাতা। */}
        {activeReport.printable === "id-card" && activeReport.backOnly && (
          <FilterSelect
            value={String(idCardBackId ?? DEFAULT_ID_CARD_BACK_ID)}
            onChange={(value) => onIdCardBackChange(Number(value))}
            wrapperClassName="min-w-[130px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value={DEFAULT_ID_CARD_BACK_ID}>{getDefaultBuiltinBackDesign().name}</option>
            <optgroup label="রেডিমেড ডিজাইন">
              {listBuiltinBackDesigns().map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name}
                </option>
              ))}
            </optgroup>
            {templates.length > 0 && (
              <optgroup label="আমার / সিস্টেম টেমপ্লেট">
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </optgroup>
            )}
          </FilterSelect>
        )}

        {cardLayoutOptions && (
          <FilterSelect
            value={cardsPerPage}
            onChange={(value) => onCardsPerPageChange(value as CardsPerPage)}
            wrapperClassName="min-w-[130px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            {cardLayoutOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        )}

        {/* একক শিক্ষার্থী মোডে: কোন পাশ ছাপব - ডিফল্ট দুই পাশ (উপরে সামনে, নিচে পিছনে); পিছনের ডিজাইন
            Talimat-এ সেট করা ডিফল্ট। */}
        {activeReport.printable === "id-card" && activeReport.backOnly && cardsPerPage === "1" && (
          <FilterSelect
            value={idCardBackWithFront ? "both" : "back"}
            onChange={(value) => onIdCardBackWithFrontChange(value === "both")}
            wrapperClassName="min-w-[130px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value="both">দুই পাশ (সামনে + পিছনে)</option>
            <option value="back">শুধু পিছনের পাশ</option>
          </FilterSelect>
        )}

        {activeReport.printable === "id-card" && !activeReport.backOnly && cardsPerPage === "1" && (
          <FilterSelect
            value={idCardPairBackId === null ? "front" : "both"}
            onChange={(value) => onIdCardPairChange(value === "both")}
            wrapperClassName="min-w-[130px] flex-1 sm:w-auto sm:flex-none"
            selectClassName={selectFieldClass}
            iconClassName={selectIconClass}
          >
            <option value="both">দুই পাশ (সামনে + পিছনে)</option>
            <option value="front">শুধু সামনের পাশ</option>
          </FilterSelect>
        )}

        {activeReport.printable === "marksheet" && onMarksheetPanelToggle && (
          <MarksheetSettingsToggleButton open={marksheetPanelOpen} onToggle={onMarksheetPanelToggle} />
        )}

        {activeReport.printable === "admit-card" && onAdmitCardPanelToggle && (
          <AdmitCardSettingsToggleButton open={admitCardPanelOpen} onToggle={onAdmitCardPanelToggle} />
        )}

        {activeReport.documentType && (
          <Link
            to={`/talimat/settings/documents`}
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

      {/* লাইন ২: কীভাবে দেখব ও কী করব - পেজ সেটআপ, পেজিনেশন, এক্সপোর্ট/প্রিন্ট */}
      <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
        <DataExportPrintActions
          layout="split"
          setupExtras={setupExtras}
          summary={summary}
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
          defaultMargins={getReportDefaultMargins(paperSize, activeReport.printable)}
          serverPdfExport={serverPdfExport}
        />
      </div>
    </div>
  );
};

export default ReportFilterBar;
