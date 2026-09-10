// Shared Bangla labels + badge color classes for every status enum used
// across the Marks/Result workflow screens (ResultWorkflowPage, the
// per-subject submission badges in MarksTable, and the correction list).
// Centralised here so every screen renders the same label/color for the
// same status instead of each screen inventing its own copy.

export type ResultMasterStatus =
  | "DRAFT"
  | "MARKS_SUBMITTED"
  | "MARKS_VERIFIED"
  | "PROCESSING"
  | "RESULT_VERIFIED"
  | "APPROVED"
  | "PUBLISHED"
  | "LOCKED";

export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED";

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";

export interface StatusBadgeInfo {
  label: string;
  /** Tailwind classes for a small rounded-full badge, light + dark. */
  className: string;
}

const badge = (className: string, label: string): StatusBadgeInfo => ({ label, className });

// Forward order of the result lifecycle - used to know which actions are
// "ahead" of the current status (e.g. to grey out an already-passed step).
export const RESULT_STATUS_ORDER: ResultMasterStatus[] = [
  "DRAFT",
  "MARKS_SUBMITTED",
  "MARKS_VERIFIED",
  "PROCESSING",
  "RESULT_VERIFIED",
  "APPROVED",
  "PUBLISHED",
  "LOCKED",
];

export const RESULT_STATUS_MAP: Record<ResultMasterStatus, StatusBadgeInfo> = {
  DRAFT: badge(
    "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300",
    "খসড়া",
  ),
  MARKS_SUBMITTED: badge(
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    "নম্বর জমা হয়েছে",
  ),
  MARKS_VERIFIED: badge(
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    "নম্বর যাচাই হয়েছে",
  ),
  PROCESSING: badge(
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    "প্রসেসিং",
  ),
  RESULT_VERIFIED: badge(
    "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    "যাচাইকৃত ফলাফল",
  ),
  APPROVED: badge(
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
    "অনুমোদিত",
  ),
  PUBLISHED: badge(
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    "প্রকাশিত",
  ),
  LOCKED: badge(
    "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400",
    "লকড",
  ),
};

export const SUBMISSION_STATUS_MAP: Record<SubmissionStatus, StatusBadgeInfo> = {
  DRAFT: badge(
    "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400",
    "খসড়া",
  ),
  SUBMITTED: badge(
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    "জমা দেয়া হয়েছে",
  ),
  VERIFIED: badge(
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    "যাচাই হয়েছে",
  ),
  REJECTED: badge(
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    "বাতিল হয়েছে",
  ),
};

export const CORRECTION_STATUS_MAP: Record<CorrectionStatus, StatusBadgeInfo> = {
  PENDING: badge(
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    "অপেক্ষমান",
  ),
  APPROVED: badge(
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    "অনুমোদিত",
  ),
  REJECTED: badge(
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    "বাতিল",
  ),
  APPLIED: badge(
    "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400",
    "প্রয়োগ হয়েছে",
  ),
};

export const RESULT_STATUS_FILTERS: { value: ResultMasterStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "সব" },
  { value: "DRAFT", label: "খসড়া" },
  { value: "MARKS_SUBMITTED", label: "নম্বর জমা হয়েছে" },
  { value: "MARKS_VERIFIED", label: "নম্বর যাচাই হয়েছে" },
  { value: "PROCESSING", label: "প্রসেসিং" },
  { value: "RESULT_VERIFIED", label: "যাচাইকৃত ফলাফল" },
  { value: "APPROVED", label: "অনুমোদিত" },
  { value: "PUBLISHED", label: "প্রকাশিত" },
  { value: "LOCKED", label: "লকড" },
];

export function resultStatusBadge(status: string | null | undefined): StatusBadgeInfo {
  if (status && status in RESULT_STATUS_MAP) return RESULT_STATUS_MAP[status as ResultMasterStatus];
  return badge("bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", status || "অজানা");
}

export function submissionStatusBadge(status: string | null | undefined): StatusBadgeInfo {
  if (status && status in SUBMISSION_STATUS_MAP) return SUBMISSION_STATUS_MAP[status as SubmissionStatus];
  return badge("bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", status || "খসড়া");
}

export function correctionStatusBadge(status: string | null | undefined): StatusBadgeInfo {
  if (status && status in CORRECTION_STATUS_MAP) return CORRECTION_STATUS_MAP[status as CorrectionStatus];
  return badge("bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", status || "অজানা");
}

/** Result-level permission strings, each with the legacy "result.manage"
 * fallback the backend also accepts for un-migrated custom roles - mirror
 * that OR-logic wherever a workflow action button's visibility is decided. */
export const RESULT_PERMISSIONS = {
  marksRead: "marks.read",
  marksManage: "marks.manage",
  marksSubmit: "marks.submit",
  marksVerify: "marks.verify",
  resultProcess: "result.process",
  resultVerify: "result.verify",
  resultApprove: "result.approve",
  resultPublish: "result.publish",
  resultLock: "result.lock",
  resultCorrect: "result.correct",
  legacyFallback: "result.manage",
} as const;
