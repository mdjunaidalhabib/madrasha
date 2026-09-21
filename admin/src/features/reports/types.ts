import type { BackendDocumentType } from "@madrasha/shared-ui/src/components/DocumentDesigner/documentTypeMap";

export type ReportColumn = {
  header: string;
  key: string;
  className?: string;
};

export type ReportMenuItem = {
  key: string;
  title: string;
  subtitle: string;
  endpoint: string;
  columns: ReportColumn[];
  // Set on report types whose columns the user can tune from a "কলাম" menu
  // (show/hide/reorder, like the student list) - the full ordered pool to
  // pick from, a superset of `columns`. `columns` itself then acts as the
  // default-visible set; ReportShell swaps in the user's own pick before
  // handing the report to the preview/export.
  columnOptions?: ReportColumn[];
  groupTitle?: string;
  requiresExam?: boolean;
  // Set on report types whose backend query can get heavy without a
  // division narrowing it down (full academic-result set, every published
  // result notice, every class routine) - ReportShell then withholds the
  // fetch and shows "বিভাগ নির্বাচন করুন" instead of defaulting to
  // "সকল বিভাগ" (still offered as an explicit choice in the dropdown).
  requiresDivision?: boolean;
  defaultOrientation?: "portrait" | "landscape";
  // Paper size this report starts on (default "a4") - e.g. the admit card
  // starts on A5 landscape, the size its 190x132mm design fits exactly.
  defaultPaperSize?: "a4" | "a5";
  // Set on the 5 document-template-driven report types (id-card, admit-card
  // /admit-card-with-rules, certificate, testimonial, transfer-letter) so
  // ReportFilterBar/ReportShell know to offer a "pick a non-default
  // published template" control for this report - see IdCardGrid and
  // siblings under components/Report/documents/.
  documentType?: BackendDocumentType;
  // id-card only: this menu entry prints ONLY the back side of every card
  // (the "আইডি কার্ড ব্যাক" report) - no front design, so ReportFilterBar hides
  // the front-design select and IdCardGrid renders the chosen back as the card.
  backOnly?: boolean;
  // Extra static query params merged into the endpoint request alongside
  // exam_id (e.g. distinguishing two menu entries that hit the same
  // endpoint with a different filter flag, like the plain-rank vs.
  // rank+mumtaz prize book label reports).
  extraParams?: Record<string, string>;
  // Set on report types whose rows carry a per-student `subjects` array
  // (exam-number-sheet and the signature+number-sheet variants) so
  // ReportFilterBar offers a "বিষয়" dropdown that narrows every row down to
  // one subject - see ReportShell's subjectOptions/displayRows.
  hasSubjectFilter?: boolean;
  printable?:
    | "table"
    | "marksheet"
    | "result-notice"
    | "id-card"
    | "admit-card"
    | "admit-card-with-rules"
    | "certificate"
    | "testimonial"
    | "transfer-letter"
    | "attendance-register"
    | "daily-attendance-register"
    | "digital-attendance"
    | "academic-result"
    | "class-routine"
    | "student-admission-list"
    | "guardian-phone-list"
    | "teacher-list"
    | "teacher-phone-list"
    | "exam-signature-sheet"
    | "exam-number-sheet"
    | "exam-signature-number-sheet"
    | "exam-signature-number-sheet-2col"
    | "book-label"
    | "notice-board";
};

export type Division = {
  division_id: number;
  division_name_bn: string;
};

export type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

export type ExamItem = {
  id: number;
  name: string;
  year?: string;
};

export type ReportShellProps = {
  pageTitle?: string;
  pageSubtitle?: string;
  accentTitle?: string;
  reports: ReportMenuItem[];
  hideBrandHeader?: boolean;
  // ID/নাম/মোবাইল সার্চ বক্স - শুধু ডকুমেন্ট সমূহ পেজে (অনেকগুলো ভিন্ন
  // ডকুমেন্ট টাইপের মধ্যে একজন নির্দিষ্ট শিক্ষার্থী খুঁজে বের করার জন্য) দরকার,
  // বাকি রিপোর্ট পেজে দেখানো হয় না।
  showSearch?: boolean;
  // /:madrasaSlug/print/reports/<reportsPageKey> - "PDF" বাটন ক্লিক করলে
  // backend-এর headless-browser export ঠিক কোন প্রিন্ট-রুটে নেভিগেট করবে তা
  // চিহ্নিত করে। প্রতিটা *ReportPage.tsx-এর নিজস্ব একটা মান আছে
  // ("academic"/"student"/"exam"/"teacher"/"documents") - router.tsx-এর
  // /print/reports/:key রুটগুলোর সাথে মিলিয়ে রাখা।
  reportsPageKey: string;
  // true হলে sidebar/filter-bar/হেডার লুকিয়ে শুধু প্রিভিউ রেন্ডার হয়, এবং
  // URL query params থেকে ফিল্টার state হাইড্রেট হয় - server-side PDF export
  // (backend/report-export.service.ts) এই মোডে headless browser দিয়ে পেজটা
  // লোড করে।
  printMode?: boolean;
};

export type AttendancePrintProps = {
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
};

export type ReportContentProps = {
  loading: boolean;
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
};
