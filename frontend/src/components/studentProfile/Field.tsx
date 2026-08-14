import { FaEdit } from "react-icons/fa";

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
}: any) => {
  const isEditing = isEditMode && editableField === name;

  return (
    <div className="flex flex-col relative">
      <label className="text-sm mb-1 dark:text-slate-300">{label}</label>

      {/* 🔥 SELECT FIELD (DIRECT EDIT MODE) */}
      {type === "select" ? (
        isEditMode ? (
          <select
            name={name}
            value={value ?? ""}
            onChange={onChange}
            className={`border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100
              ${error ? "border-red-500" : ""}
            `}
          >
            <option value="">নির্বাচন করুন</option>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {options.find((o: any) => o.value == value)?.label || "N/A"}
          </p>
        )
      ) : (
        <>
          {/* 🔥 INPUT FIELD */}
          <input
            type={type}
            min={type === "number" ? 1 : undefined}
            name={name}
            value={value || ""}
            onChange={onChange}
            disabled={!isEditMode || !isEditing}
            className={`border rounded-lg px-3 py-2 pr-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100
              ${error ? "border-red-500" : ""}
              ${!isEditMode ? "bg-gray-100 dark:bg-slate-800" : ""}
              ${isEditing ? "border-blue-500 bg-white dark:bg-slate-900" : ""}
            `}
          />

          {/* ✏️ EDIT ICON (ONLY INPUT FIELD) */}
          {isEditMode && (
            <FaEdit
              className="absolute right-3 top-9 cursor-pointer text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              onClick={() => setEditableField(name)}
            />
          )}
        </>
      )}

      {error && <span className="text-red-500 text-xs mt-1">{error}</span>}
    </div>
  );
};

export default Field;
