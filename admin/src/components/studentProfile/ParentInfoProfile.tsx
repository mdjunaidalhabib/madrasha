import Field from "./Field";
import { useText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "../admission/admission.text";

const ParentInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode, // ✅ added
}: any) => {
  const t = useText(admissionText);
  const isMadrasa = useIsMadrasa();
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">{t.parentInfo}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label={t.fatherNameBn}
          name="father_name"
          value={student.father_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="bn"
        />
        {isMadrasa && (
          <Field
            label={t.fatherNameAr}
            name="father_arabic_name"
            value={student.father_arabic_name}
            onChange={handleChange}
            editableField={editableField}
            setEditableField={setEditableField}
            isEditMode={isEditMode} // ✅ pass
            scriptLang="ar"
          />
        )}
        <Field
          label={t.fatherNameEn}
          name="father_name_en"
          value={student.father_name_en}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="en"
        />
        <Field
          label={t.fatherNid}
          name="father_nid"
          value={student.father_nid}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          numeric
        />
        <Field
          label={t.fatherOccupation}
          name="father_occupation"
          value={student.father_occupation}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label={t.motherNameBn}
          name="mother_name"
          value={student.mother_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="bn"
        />
        {isMadrasa && (
          <Field
            label={t.motherNameAr}
            name="mother_arabic_name"
            value={student.mother_arabic_name}
            onChange={handleChange}
            editableField={editableField}
            setEditableField={setEditableField}
            isEditMode={isEditMode} // ✅ pass
            scriptLang="ar"
          />
        )}
        <Field
          label={t.motherNameEn}
          name="mother_name_en"
          value={student.mother_name_en}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="en"
        />
        <Field
          label={t.motherNid}
          name="mother_nid"
          value={student.mother_nid}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          numeric
        />
        <Field
          label={t.motherOccupation}
          name="mother_occupation"
          value={student.mother_occupation}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label={t.guardianMobile}
          name="guardian_phone"
          value={student.guardian_phone}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          numeric
        />
        <Field
          label={t.guardianAltMobile}
          name="guardian_phone_2"
          value={student.guardian_phone_2}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          numeric
        />
      </div>
    </div>
  );
};

export default ParentInfoProfile;
