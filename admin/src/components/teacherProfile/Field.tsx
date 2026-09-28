import { useState } from "react";
import { FaEdit } from "react-icons/fa";
import { filterByScript, ScriptLang } from "@madrasha/shared-ui/src/components/ui/ScriptInput";
import { filterToDigits } from "@madrasha/shared-ui/src/components/ui/NumericInput";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { uiText } from "@madrasha/shared-ui/src/components/ui/ui.text";

const SCRIPT_HINT_KEYS = {
  bn: "onlyBangla",
  ar: "onlyArabic",
  en: "onlyEnglish",
} as const satisfies Record<ScriptLang, string>;

interface Props {
  label: string;
  name: string;
  value: any;
  onChange?: any;

  isEditMode?: boolean;
  editableField?: string | null;
  setEditableField?: (field: string | null) => void;

  type?: string;
  options?: { label: string; value: string }[];
  scriptLang?: ScriptLang;
  numeric?: boolean;

  error?: string;
}

const Field: React.FC<Props> = ({
  label,
  name,
  value,
  onChange,
  isEditMode,
  editableField,
  setEditableField,
  type = "text",
  options,
  scriptLang,
  numeric,
  error,
}) => {
  const ut = useText(uiText);
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
    <div className="flex flex-col relative">
      <label className="text-sm mb-1 dark:text-slate-300">{label}</label>

      {/* SELECT */}
      {type === "select" ? (
        <select
          name={name}
          value={value || ""}
          onChange={onChange}
          disabled={!isEditMode}
          className="border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">{c.select}</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          inputMode={numeric ? "numeric" : undefined}
          name={name}
          value={value || ""}
          onChange={handleScriptChange}
          disabled={!isEditMode || !isEditing}
          dir={scriptLang === "ar" ? "rtl" : undefined}
          className={`border rounded-lg px-3 py-2 pe-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100
            ${!isEditMode ? "bg-gray-100 dark:bg-slate-800" : ""}
            ${isEditing ? "border-blue-500 bg-white dark:bg-slate-900" : ""}
          `}
        />
      )}

      {/* EDIT ICON */}
      {isEditMode && setEditableField && (
        <FaEdit
          className="absolute end-3 top-9 cursor-pointer text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          onClick={() => setEditableField(name)}
        />
      )}

      {scriptLang && isEditing && showScriptHint && (
        <span className="text-[11px] text-gray-400 mt-0.5 dark:text-slate-500">
          {ut[SCRIPT_HINT_KEYS[scriptLang]]}
        </span>
      )}

      {error && <span className="text-red-500 text-xs dark:text-red-400">{error}</span>}
    </div>
  );
};

export default Field;
