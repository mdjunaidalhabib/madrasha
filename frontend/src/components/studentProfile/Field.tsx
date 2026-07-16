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
      <label className="text-sm mb-1">{label}</label>

      {/* 🔥 SELECT FIELD (DIRECT EDIT MODE) */}
      {type === "select" ? (
        isEditMode ? (
          <select
            name={name}
            value={value ?? ""}
            onChange={onChange}
            className={`border rounded-lg px-3 py-2
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
          <p className="border rounded-lg px-3 py-2 bg-gray-100">
            {options.find((o: any) => o.value == value)?.label || "N/A"}
          </p>
        )
      ) : (
        <>
          {/* 🔥 INPUT FIELD */}
          <input
            name={name}
            value={value || ""}
            onChange={onChange}
            disabled={!isEditMode || !isEditing}
            className={`border rounded-lg px-3 py-2 pr-10
              ${error ? "border-red-500" : ""}
              ${!isEditMode ? "bg-gray-100" : ""}
              ${isEditing ? "border-blue-500 bg-white" : ""}
            `}
          />

          {/* ✏️ EDIT ICON (ONLY INPUT FIELD) */}
          {isEditMode && (
            <FaEdit
              className="absolute right-3 top-9 cursor-pointer text-gray-500 hover:text-blue-600"
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
