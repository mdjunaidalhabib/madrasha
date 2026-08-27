import Field from "./Field";

const ParentInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode, // ✅ added
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">অভিভাবকের তথ্য</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label="পিতার নাম (বাংলা)"
          name="father_name"
          value={student.father_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="bn"
        />
        <Field
          label="পিতার নাম (আরবি)"
          name="father_arabic_name"
          value={student.father_arabic_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="ar"
        />
        <Field
          label="পিতার নাম (ইংরেজি)"
          name="father_name_en"
          value={student.father_name_en}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="en"
        />
        <Field
          label="পিতার NID"
          name="father_nid"
          value={student.father_nid}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          numeric
        />
        <Field
          label="পিতার পেশা"
          name="father_occupation"
          value={student.father_occupation}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="মাতার নাম (বাংলা)"
          name="mother_name"
          value={student.mother_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="bn"
        />
        <Field
          label="মাতার নাম (আরবি)"
          name="mother_arabic_name"
          value={student.mother_arabic_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="ar"
        />
        <Field
          label="মাতার নাম (ইংরেজি)"
          name="mother_name_en"
          value={student.mother_name_en}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          scriptLang="en"
        />
        <Field
          label="মাতার NID"
          name="mother_nid"
          value={student.mother_nid}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
          numeric
        />
        <Field
          label="মাতার পেশা"
          name="mother_occupation"
          value={student.mother_occupation}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="অভিভাবকের মোবাইল নম্বর"
          name="guardian_phone"
          value={student.guardian_phone}
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
