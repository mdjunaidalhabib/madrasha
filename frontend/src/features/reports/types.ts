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
  groupTitle?: string;
  requiresExam?: boolean;
  defaultOrientation?: "portrait" | "landscape";
  printable?:
    | "table"
    | "marksheet"
    | "result-notice"
    | "id-card"
    | "admit-card"
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
    | "exam-number-sheet";
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
  pageTitle: string;
  pageSubtitle: string;
  accentTitle: string;
  reports: ReportMenuItem[];
  hideBrandHeader?: boolean;
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
