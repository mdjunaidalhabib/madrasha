import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLanguageStore } from "./languageStore";
import { LANGUAGE_LABELS } from "./types";

/**
 * Topbar language picker - lists only the languages this tenant's institution
 * offers (bn/en). Hidden when only one.
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
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const triggerId = useId();
  const label = lang === "bn" ? "ভাষা নির্বাচন করুন" : "Choose language";

  useEffect(() => {
    if (!open) return;
    options.current[languages.indexOf(lang)]?.focus();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, lang, languages]);

  if (languages.length < 2) return null;

  return (
    <div
      ref={ref}
      className={`relative shrink-0 ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${LANGUAGE_LABELS[lang]}`}
        title="বাংলা / English"
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-teal-200 bg-white py-1 pe-2.5 ps-1 text-xs font-medium text-teal-800 motion-safe:transition-colors hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 ${open ? "ring-2 ring-teal-500/10" : ""}`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <Globe size={14} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span lang={lang}>{LANGUAGE_LABELS[lang]}</span>
        <ChevronDown size={12} aria-hidden="true" className={`text-teal-600 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={(event) => {
            const index = options.current.indexOf(document.activeElement as HTMLButtonElement);
            let next: number;
            if (event.key === "ArrowDown") next = (index + 1) % languages.length;
            else if (event.key === "ArrowUp") next = (index - 1 + languages.length) % languages.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = languages.length - 1;
            else return;
            event.preventDefault();
            options.current[next]?.focus();
          }}
          className={`absolute end-0 z-50 min-w-[11rem] space-y-1 overflow-hidden rounded-2xl border border-teal-100 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(15,118,110,0.2)] ${dropUp ? "bottom-full mb-2.5" : "top-full mt-2.5"}`}
        >
          {languages.map((code, index) => (
            <li key={code} role="none">
              <button
                ref={(element) => { options.current[index] = element; }}
                type="button"
                role="menuitemradio"
                aria-checked={code === lang}
                tabIndex={-1}
                lang={code}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                  trigger.current?.focus();
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${code === lang ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span>{LANGUAGE_LABELS[code]}</span>
                {code === lang && <Check size={15} aria-hidden="true" className="text-teal-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
