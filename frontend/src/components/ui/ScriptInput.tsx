import React, { useState } from "react";

export type ScriptLang = "bn" | "ar" | "en";

const SCRIPT_PATTERNS: Record<ScriptLang, RegExp> = {
  bn: /[^ঀ-৿\s.'-]/g,
  ar: /[^؀-ۿ\s.'-]/g,
  en: /[^A-Za-z\s.'-]/g,
};

const SCRIPT_HINTS: Record<ScriptLang, string> = {
  bn: "শুধু বাংলায় লিখুন",
  ar: "শুধু আরবিতে লিখুন",
  en: "Write in English only",
};

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
            {SCRIPT_HINTS[scriptLang]}
          </span>
        )}
      </>
    );
  }
);

ScriptInput.displayName = "ScriptInput";

export default ScriptInput;
