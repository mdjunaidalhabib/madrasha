import { profileSectionClass, profileHeadingClass, profileValueClass } from "./profileStyles";
import Field from "./Field";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "../admission/admission.text";
import { studentProfileText } from "./studentProfile.text";
import AddressCascadeFields, { AddressField } from "@madrasha/shared-ui/src/components/ui/AddressCascadeFields";

const addressSelectClass =
  "border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 border-blue-500 bg-white dark:bg-slate-900";

const AddressInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const t = useText(admissionText);
  const pt = useText(studentProfileText);
  const handleAddressFieldChange = (field: AddressField, value: string) => {
    handleChange({ target: { name: field, value } });
  };

  return (
    <div className={profileSectionClass}>
      <h2 className={profileHeadingClass}>{t.addressInfo}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
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
              <label className="text-sm mb-1 dark:text-slate-300">{pt.addrDivision}</label>
              <p className={profileValueClass}>
                {student.division || pt.notAvailable}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">{pt.district}</label>
              <p className={profileValueClass}>
                {student.district || pt.notAvailable}
              </p>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1 dark:text-slate-300">{pt.thana}</label>
              <p className={profileValueClass}>
                {student.thana || pt.notAvailable}
              </p>
            </div>
          </>
        )}

        <Field
          label={t.village}
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
