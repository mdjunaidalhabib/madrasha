import Field from "./Field";
import { useText, commonText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "../admission/admission.text";
import { studentProfileText } from "./studentProfile.text";

const AlternateGuardianInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const t = useText(admissionText);
  const pt = useText(studentProfileText);
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">{pt.altGuardianInfo}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label={t.guardianNameBn}
          name="alt_guardian_name"
          value={student.alt_guardian_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="bn"
        />
        {isMadrasa && (
          <Field
            label={t.guardianNameAr}
            name="alt_guardian_arabic_name"
            value={student.alt_guardian_arabic_name}
            onChange={handleChange}
            editableField={editableField}
            setEditableField={setEditableField}
            isEditMode={isEditMode}
            scriptLang="ar"
          />
        )}
        <Field
          label={t.guardianNameEn}
          name="alt_guardian_name_en"
          value={student.alt_guardian_name_en}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="en"
        />
        <Field
          label={t.relation}
          name="alt_guardian_relation"
          value={student.alt_guardian_relation}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />
        <Field
          label={t.mobileNo}
          name="alt_guardian_phone"
          value={student.alt_guardian_phone}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          numeric
        />
        <Field
          label={c.address}
          name="alt_guardian_address"
          value={student.alt_guardian_address}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />
      </div>
    </div>
  );
};

export default AlternateGuardianInfoProfile;
