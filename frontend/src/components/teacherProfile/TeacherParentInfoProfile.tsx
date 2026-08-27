import Field from "./Field";

const TeacherParentInfoProfile = ({
  data,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">পারিবারিক তথ্য</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label="পিতার নাম (বাংলা)"
          name="father_name"
          value={data.father_name}
          onChange={handleChange}
          scriptLang="bn"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="পিতার নাম (আরবি)"
          name="father_name_ar"
          value={data.father_name_ar}
          onChange={handleChange}
          scriptLang="ar"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="পিতার নাম (ইংরেজি)"
          name="father_name_en"
          value={data.father_name_en}
          onChange={handleChange}
          scriptLang="en"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="পিতার NID"
          name="father_nid"
          value={data.father_nid}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="পিতার পেশা"
          name="father_occupation"
          value={data.father_occupation}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মাতার নাম (বাংলা)"
          name="mother_name"
          value={data.mother_name}
          onChange={handleChange}
          scriptLang="bn"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মাতার নাম (আরবি)"
          name="mother_name_ar"
          value={data.mother_name_ar}
          onChange={handleChange}
          scriptLang="ar"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মাতার নাম (ইংরেজি)"
          name="mother_name_en"
          value={data.mother_name_en}
          onChange={handleChange}
          scriptLang="en"
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মাতার NID"
          name="mother_nid"
          value={data.mother_nid}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মাতার পেশা"
          name="mother_occupation"
          value={data.mother_occupation}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মোবাইল"
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
