import { useState } from "react";
import { FaEdit } from "react-icons/fa";
import { filterByScript, ScriptLang } from "../ui/ScriptInput";
import { filterToDigits } from "../ui/NumericInput";

const SCRIPT_HINTS: Record<ScriptLang, string> = {
  bn: "শুধু বাংলায় লিখুন",
  ar: "শুধু আরবিতে লিখুন",
  en: "Write in English only",
};

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
          <option value="">Select</option>
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
          className={`border rounded-lg px-3 py-2 pr-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100
            ${!isEditMode ? "bg-gray-100 dark:bg-slate-800" : ""}
            ${isEditing ? "border-blue-500 bg-white dark:bg-slate-900" : ""}
          `}
        />
      )}

      {/* EDIT ICON */}
      {isEditMode && setEditableField && (
        <FaEdit
          className="absolute right-3 top-9 cursor-pointer text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          onClick={() => setEditableField(name)}
        />
      )}

      {scriptLang && isEditing && showScriptHint && (
        <span className="text-[11px] text-gray-400 mt-0.5 dark:text-slate-500">
          {SCRIPT_HINTS[scriptLang]}
        </span>
      )}

      {error && <span className="text-red-500 text-xs dark:text-red-400">{error}</span>}
    </div>
  );
};

export default Field;
