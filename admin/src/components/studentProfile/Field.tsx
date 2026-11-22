import { useEffect, useRef, useState } from "react";
import { FaCheck, FaEdit } from "react-icons/fa";
import { filterByScript, ScriptLang } from "@madrasha/shared-ui/src/components/ui/ScriptInput";
import { filterToDigits } from "@madrasha/shared-ui/src/components/ui/NumericInput";
import { useText, commonText } from "@madrasha/shared-ui/src/i18n";
import { studentProfileText } from "./studentProfile.text";
import { profileValueClass } from "./profileStyles";

const Field = ({
  label,
  name,
  value,
  onChange,
  editableField,
  setEditableField,
  error,
  isEditMode,
  type = "text",
  options = [],
  scriptLang,
  numeric,
}: any) => {
  const pt = useText(studentProfileText);
  const c = useText(commonText);
  const isEditing = isEditMode && editableField === name;
  const inputRef = useRef<HTMLInputElement>(null);
  const [showScriptHint, setShowScriptHint] = useState(false);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
    setShowScriptHint(false);
  }, [isEditing]);

  const handleScriptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (scriptLang) {
      const filtered = filterByScript(e.target.value, scriptLang);
      setShowScriptHint(filtered !== e.target.value);
      if (filtered !== e.target.value) {
        e.target.value = filtered;
      }
    } else if (numeric) {
      const filtered = filterToDigits(e.target.value);
      if (filtered !== e.target.value) {
        e.target.value = filtered;
      }
    }
    onChange(e);
  };

  return (
    <div className="group relative flex min-w-0 flex-col">
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <label htmlFor={`student-${name}`} className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
        {isEditMode && type !== "select" && (
          <button
            type="button"
            aria-label={`${isEditing ? pt.finishEditing : c.edit}: ${label}`}
            title={isEditing ? pt.finishEditing : c.edit}
            aria-controls={`student-${name}`}
            aria-pressed={Boolean(isEditing)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isEditing ? "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
            onClick={() => setEditableField(isEditing ? null : name)}
          >{isEditing ? <FaCheck className="h-3 w-3" aria-hidden="true" /> : <FaEdit className="h-3.5 w-3.5" aria-hidden="true" />}</button>
        )}
      </div>

      {/* 🔥 SELECT FIELD (DIRECT EDIT MODE) */}
      {type === "select" ? (
        isEditMode ? (
          <select
            id={`student-${name}`}
            name={name}
            value={value ?? ""}
            onChange={onChange}
            className={`border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100
              ${error ? "border-red-500" : ""}
            `}
          >
            <option value="">{c.select}</option>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <p className={profileValueClass}>
            {options.find((o: any) => o.value == value)?.label || pt.notAvailable}
          </p>
        )
      ) : (
        <>
          {/* 🔥 INPUT FIELD */}
          {!isEditMode ? <p dir={scriptLang === "ar" ? "rtl" : undefined} className={profileValueClass}>{value === "" || value == null ? pt.notAvailable : value}</p> : <input
            ref={inputRef}
            id={`student-${name}`}
            type={type}
            min={type === "number" ? 1 : undefined}
            inputMode={numeric ? "numeric" : undefined}
            name={name}
            value={value ?? ""}
            onChange={handleScriptChange}
            readOnly={!isEditing}
            dir={scriptLang === "ar" ? "rtl" : undefined}
            onKeyDown={(e) => {
              if (isEditing && e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                setEditableField(null);
              }
            }}
            className={`min-h-11 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors dark:text-slate-100
              ${error ? "border-red-500 focus:ring-2 focus:ring-red-500/20" : isEditing ? "border-teal-500 ring-2 ring-teal-500/15 dark:border-teal-400" : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"}
              ${isEditing ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/40"}
            `}
          />}

          {scriptLang && isEditing && showScriptHint && (
            <span className="text-[11px] text-gray-400 mt-0.5 dark:text-slate-500">
              {pt.scriptHint[scriptLang as ScriptLang]}
            </span>
          )}
        </>
      )}

      {error && <span className="text-red-500 text-xs mt-1">{error}</span>}
    </div>
  );
};

export default Field;
