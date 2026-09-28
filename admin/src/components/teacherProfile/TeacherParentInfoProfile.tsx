import Field from "./Field";
import { useText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

const TeacherParentInfoProfile = ({
  data,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const t = useText(teacherStaffText);
  const isMadrasa = useIsMadrasa();
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">{t.familyInfo}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label={t.fatherNameBn}
          name="father_name"
          value={data.father_name}
          onChange={handleChange}
          scriptLang="bn"
          {...{ editableField, setEditableField, isEditMode }}
        />

        {isMadrasa && (
          <Field
            label={t.fatherNameAr}
            name="father_name_ar"
            value={data.father_name_ar}
            onChange={handleChange}
            scriptLang="ar"
            {...{ editableField, setEditableField, isEditMode }}
          />
        )}

        <Field
          label={t.fatherNameEn}
          name="father_name_en"
          value={data.father_name_en}
          onChange={handleChange}
          scriptLang="en"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label={t.fatherNid}
          name="father_nid"
          value={data.father_nid}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label={t.fatherOccupation}
          name="father_occupation"
          value={data.father_occupation}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label={t.motherNameBn}
          name="mother_name"
          value={data.mother_name}
          onChange={handleChange}
          scriptLang="bn"
          {...{ editableField, setEditableField, isEditMode }}
        />

        {isMadrasa && (
          <Field
            label={t.motherNameAr}
            name="mother_name_ar"
            value={data.mother_name_ar}
            onChange={handleChange}
            scriptLang="ar"
            {...{ editableField, setEditableField, isEditMode }}
          />
        )}

        <Field
          label={t.motherNameEn}
          name="mother_name_en"
          value={data.mother_name_en}
          onChange={handleChange}
          scriptLang="en"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label={t.motherNid}
          name="mother_nid"
          value={data.mother_nid}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label={t.motherOccupation}
          name="mother_occupation"
          value={data.mother_occupation}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label={t.fields.mobile}
          name="parent_phone"
          value={data.parent_phone}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />
      </div>
    </div>
  );
};

export default TeacherParentInfoProfile;
