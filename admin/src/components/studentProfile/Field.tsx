import { useState } from "react";
import { FaEdit } from "react-icons/fa";
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
  const [showScriptHint, setShowScriptHint] = useState(false);

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
      <label htmlFor={`student-${name}`} className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>

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
            id={`student-${name}`}
            type={type}
            min={type === "number" ? 1 : undefined}
            inputMode={numeric ? "numeric" : undefined}
            name={name}
            value={value || ""}
            onChange={handleScriptChange}
            readOnly={!isEditing}
            dir={scriptLang === "ar" ? "rtl" : undefined}
            className={`min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 pe-10 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
              ${error ? "border-red-500" : ""}
              ${isEditing ? "border-blue-500 bg-white dark:bg-slate-900" : ""}
            `}
          />}

          {/* ✏️ EDIT ICON (ONLY INPUT FIELD) */}
          {isEditMode && (
            <button
              type="button"
              aria-label={`${c.edit}: ${label}`}
              aria-controls={`student-${name}`}
              className="absolute end-1 top-6 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-teal-950 dark:hover:text-teal-300"
              onClick={() => setEditableField(name)}
            ><FaEdit aria-hidden="true" /></button>
          )}

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
