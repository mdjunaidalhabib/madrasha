import Field from "./Field";
import AddressCascadeFields, { AddressField } from "@madrasha/shared-ui/src/components/ui/AddressCascadeFields";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

const addressSelectClass =
  "border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 border-blue-500 bg-white dark:bg-slate-900";

const TeacherAddressProfile = ({
  data,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const handleAddressFieldChange = (field: AddressField, value: string) => {
    handleChange({ target: { name: field, value } });
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">{t.addressInfo}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isEditMode ? (
          <AddressCascadeFields
            values={{
              division: data.division || "",
              district: data.district || "",
              thana: data.thana || "",
            }}
            onChange={handleAddressFieldChange}
            selectClassName={addressSelectClass}
            labelClassName="text-sm mb-1 dark:text-slate-300"
          />
        ) : (
          <>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">{t.addressDivision}</label>
              <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {data.division || t.none}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">{t.district}</label>
              <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {data.district || t.none}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">{t.thana}</label>
              <p className="border rounded-lg px-3 py-2 bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {data.thana || t.none}
              </p>
            </div>
          </>
        )}

        <Field
          label={t.village}
          name="village"
          value={data.village}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />
      </div>
    </div>
  );
};

export default TeacherAddressProfile;
