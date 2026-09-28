import {
  INSTITUTION_TYPE_LABELS,
  LANGUAGE_LABELS,
  useLang,
  type InstitutionType,
  type Lang,
} from "@madrasha/shared-ui/src/i18n";

const TYPE_STYLES: Record<InstitutionType, string> = {
  MADRASA: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  SCHOOL: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
  COLLEGE: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900",
  KINDERGARTEN: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
};

/** Small colored pill naming a tenant's / catalogue division's institution type. */
export default function InstitutionTypeBadge({
  type,
  className = "",
}: {
  type?: InstitutionType | null;
  className?: string;
}) {
  const lang = useLang();
  const t: InstitutionType = type ?? "MADRASA";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TYPE_STYLES[t]} ${className}`}
    >
      {INSTITUTION_TYPE_LABELS[t][lang]}
    </span>
  );
}

/** Tiny language chip ("বাংলা" / "English"). */
export function LanguageChip({ lang, className = "" }: { lang?: Lang | null; className?: string }) {
  if (!lang) return null;
  return (
    <span
      lang={lang}
      className={`inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className}`}
    >
      {LANGUAGE_LABELS[lang]}
    </span>
  );
}
