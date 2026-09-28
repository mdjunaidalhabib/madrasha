import { getText } from "@madrasha/shared-ui/src/i18n";
import { resultPanelText } from "./resultPanel.text";

// Shared translated labels + badge color classes for every status enum used
// across the Marks/Result screens (the per-subject submission badges in
// MarksTable, and other result status displays). Centralised here so every
// screen renders the same label/color for the same status instead of each
// screen inventing its own copy.

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

// Labels are read lazily (getter) so they follow the current UI language.
const badge = (className: string, label: () => string): StatusBadgeInfo => ({
  className,
  get label() {
    return label();
  },
});

const L = () => getText(resultPanelText).status;

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
    () => L().result.DRAFT,
  ),
  MARKS_SUBMITTED: badge(
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    () => L().result.MARKS_SUBMITTED,
  ),
  MARKS_VERIFIED: badge(
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    () => L().result.MARKS_VERIFIED,
  ),
  PROCESSING: badge(
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    () => L().result.PROCESSING,
  ),
  RESULT_VERIFIED: badge(
    "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    () => L().result.RESULT_VERIFIED,
  ),
  APPROVED: badge(
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
    () => L().result.APPROVED,
  ),
  PUBLISHED: badge(
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    () => L().result.PUBLISHED,
  ),
  LOCKED: badge(
    "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400",
    () => L().result.LOCKED,
  ),
};

export const SUBMISSION_STATUS_MAP: Record<SubmissionStatus, StatusBadgeInfo> = {
  DRAFT: badge(
    "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400",
    () => L().submission.DRAFT,
  ),
  SUBMITTED: badge(
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    () => L().submission.SUBMITTED,
  ),
  VERIFIED: badge(
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    () => L().submission.VERIFIED,
  ),
  REJECTED: badge(
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    () => L().submission.REJECTED,
  ),
};

export const CORRECTION_STATUS_MAP: Record<CorrectionStatus, StatusBadgeInfo> = {
  PENDING: badge(
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    () => L().correction.PENDING,
  ),
  APPROVED: badge(
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    () => L().correction.APPROVED,
  ),
  REJECTED: badge(
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    () => L().correction.REJECTED,
  ),
  APPLIED: badge(
    "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400",
    () => L().correction.APPLIED,
  ),
};

export const RESULT_STATUS_FILTERS: { value: ResultMasterStatus | "ALL"; label: string }[] = (
  ["ALL", ...RESULT_STATUS_ORDER] as (ResultMasterStatus | "ALL")[]
).map((value) => ({
  value,
  get label() {
    return value === "ALL" ? L().all : L().result[value];
  },
}));

export function resultStatusBadge(status: string | null | undefined): StatusBadgeInfo {
  if (status && status in RESULT_STATUS_MAP) return RESULT_STATUS_MAP[status as ResultMasterStatus];
  return badge("bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", () => status || L().unknown);
}

export function submissionStatusBadge(status: string | null | undefined): StatusBadgeInfo {
  if (status && status in SUBMISSION_STATUS_MAP) return SUBMISSION_STATUS_MAP[status as SubmissionStatus];
  return badge("bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", () => status || L().submission.DRAFT);
}

export function correctionStatusBadge(status: string | null | undefined): StatusBadgeInfo {
  if (status && status in CORRECTION_STATUS_MAP) return CORRECTION_STATUS_MAP[status as CorrectionStatus];
  return badge("bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400", () => status || L().unknown);
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
