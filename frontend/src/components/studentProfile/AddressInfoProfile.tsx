import Field from "./Field";
import AddressCascadeFields, { AddressField } from "../ui/AddressCascadeFields";

const addressSelectClass =
  "border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 border-blue-500 bg-white dark:bg-slate-900";

const AddressInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const handleAddressFieldChange = (field: AddressField, value: string) => {
    handleChange({ target: { name: field, value } });
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">ঠিকানার তথ্য</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isEditMode ? (
          <AddressCascadeFields
            values={{
              division: student.division || "",
              district: student.district || "",
              thana: student.thana || "",
            }}
            onChange={handleAddressFieldChange}
            selectClassName={addressSelectClass}
            labelClassName="text-sm mb-1 dark:text-slate-300"
          />
        ) : (
          <>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">বিভাগ</label>
              <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {student.division || "N/A"}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">জেলা</label>
              <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {student.district || "N/A"}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">থানা</label>
              <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {student.thana || "N/A"}
              </p>
            </div>
          </>
        )}

        <Field
          label="গ্রাম"
          name="village"
          value={student.village}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
      </div>
    </div>
  );
};

export default AddressInfoProfile;
