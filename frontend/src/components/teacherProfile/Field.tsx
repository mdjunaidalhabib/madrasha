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
      <label className="text-sm mb-1">{label}</label>

      {/* SELECT */}
      {type === "select" ? (
        <select
          name={name}
          value={value || ""}
          onChange={onChange}
          disabled={!isEditMode}
          className="border rounded-lg px-3 py-2"
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
          className={`border rounded-lg px-3 py-2 pr-10
            ${!isEditMode ? "bg-gray-100" : ""}
            ${isEditing ? "border-blue-500 bg-white" : ""}
          `}
        />
      )}

      {/* EDIT ICON */}
      {isEditMode && setEditableField && (
        <FaEdit
          className="absolute right-3 top-9 cursor-pointer text-gray-500 hover:text-blue-600"
          onClick={() => setEditableField(name)}
        />
      )}

      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
};

export default Field;
