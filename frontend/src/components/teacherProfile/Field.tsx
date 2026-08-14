import { FaEdit } from "react-icons/fa";

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
  error,
}) => {
  const isEditing = isEditMode && editableField === name;

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
          name={name}
          value={value || ""}
          onChange={onChange}
          disabled={!isEditMode || !isEditing}
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

      {error && <span className="text-red-500 text-xs dark:text-red-400">{error}</span>}
    </div>
  );
};

export default Field;
