import React, { useState } from "react";
import { useText } from "../../i18n";
import { uiText } from "./ui.text";

export type ScriptLang = "bn" | "ar" | "en";

const SCRIPT_PATTERNS: Record<ScriptLang, RegExp> = {
  bn: /[^ঀ-৿\s.'-]/g,
  ar: /[^؀-ۿ\s.'-]/g,
  en: /[^A-Za-z\s.'-]/g,
};

const SCRIPT_HINT_KEYS = {
  bn: "onlyBangla",
  ar: "onlyArabic",
  en: "onlyEnglish",
} as const satisfies Record<ScriptLang, string>;

export function filterByScript(value: string, lang: ScriptLang): string {
  return value.replace(SCRIPT_PATTERNS[lang], "");
}

interface ScriptInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "dir"> {
  scriptLang: ScriptLang;
  hint?: boolean;
  hintClassName?: string;
}

const ScriptInput = React.forwardRef<HTMLInputElement, ScriptInputProps>(
  ({ scriptLang, hint = true, hintClassName, onChange, ...props }, ref) => {
    const [showHint, setShowHint] = useState(false);
    const t = useText(uiText);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const filtered = filterByScript(e.target.value, scriptLang);
      setShowHint(filtered !== e.target.value);
      if (filtered !== e.target.value) {
        e.target.value = filtered;
      }
      onChange?.(e);
    };

    return (
      <>
        <input
          {...props}
          ref={ref}
          dir={scriptLang === "ar" ? "rtl" : "ltr"}
          onChange={handleChange}
        />
        {hint && showHint && (
          <span
            className={
              hintClassName ??
              "text-[11px] text-gray-400 mt-0.5 dark:text-slate-500"
            }
          >
            {t[SCRIPT_HINT_KEYS[scriptLang]]}
          </span>
        )}
      </>
    );
  }
);

ScriptInput.displayName = "ScriptInput";

export default ScriptInput;
