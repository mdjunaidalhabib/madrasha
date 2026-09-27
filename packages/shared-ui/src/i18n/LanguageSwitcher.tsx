import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useLanguageStore } from "./languageStore";
import { LANGUAGE_LABELS, type Lang } from "./types";

const SHORT: Record<Lang, string> = { bn: "বাং", en: "EN", ar: "ع" };

/**
 * Topbar language picker - lists only the languages this tenant's institution
 * type offers (madrasa: bn/en/ar, others: bn/en). Hidden when only one.
 */
export default function LanguageSwitcher({
  className = "",
  dropUp = false,
}: {
  className?: string;
  /** Open the menu above the button (e.g. in a bottom drawer footer). */
  dropUp?: boolean;
}) {
  const lang = useLanguageStore((s) => s.lang);
  const languages = useLanguageStore((s) => s.institution.languages);
  const setLang = useLanguageStore((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (languages.length < 2) return null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={LANGUAGE_LABELS[lang]}
        title={LANGUAGE_LABELS[lang]}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <Languages size={16} />
        <span>{SHORT[lang]}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute end-0 z-50 min-w-[9rem] ${dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"} overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800`}
        >
          {languages.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === lang}
                lang={code}
                dir={code === "ar" ? "rtl" : "ltr"}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span>{LANGUAGE_LABELS[code]}</span>
                {code === lang && <Check size={15} className="text-emerald-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
