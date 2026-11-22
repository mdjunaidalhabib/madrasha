import { useText } from "@madrasha/shared-ui/src/i18n";
import { admissionReviewText } from "../../features/students/admissionReview.text";

export function useAdmissionSourceLabel() {
  const t = useText(admissionReviewText);
  return (source?: string | null) => source === "WEBSITE" ? t.sourceWebsite : source === "ADMIN" ? t.sourceAdmin : t.sourceUnknown;
}

export default function AdmissionSourceBadge({ source }: { source?: string | null }) {
  const label = useAdmissionSourceLabel();
  const colors = source === "WEBSITE"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
    : source === "ADMIN"
      ? "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900"
      : "bg-gray-50 text-gray-600 ring-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium ring-1 ring-inset ${colors}`}>{label(source)}</span>;
}
