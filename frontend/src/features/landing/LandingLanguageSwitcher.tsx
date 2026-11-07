import { ChevronDown, Languages } from "lucide-react";
import {
  LANGUAGE_LABELS,
  useLanguageStore,
  useText,
  type Lang,
} from "@madrasha/shared-ui/src/i18n";
import { landingText } from "./landing.text";

/** Native language dropdown with keyboard, touch and screen-reader support. */
export default function LandingLanguageSwitcher() {
  const lang = useLanguageStore((s) => s.lang);
  const languages = useLanguageStore((s) => s.institution.languages);
  const setLang = useLanguageStore((s) => s.setLang);
  const t = useText(landingText);
  if (languages.length < 2) return null;
  return (
    <label className="relative inline-flex shrink-0 items-center">
      <Languages
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute start-2.5 text-slate-400"
      />
      <select
        aria-label={t.languageLabel}
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        className="h-8 w-[100px] cursor-pointer appearance-none rounded-lg border border-slate-200/80 bg-slate-50/70 pe-6 ps-8 text-xs font-medium text-slate-500 outline-none hover:border-emerald-300 hover:bg-white hover:text-emerald-700 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20 motion-safe:transition-colors sm:h-9 sm:w-[104px]"
      >
        {languages.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        aria-hidden="true"
        className="pointer-events-none absolute end-2.5 text-slate-400"
      />
    </label>
  );
}
