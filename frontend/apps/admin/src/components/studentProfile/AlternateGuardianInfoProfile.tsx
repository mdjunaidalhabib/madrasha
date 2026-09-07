import Field from "./Field";

const AlternateGuardianInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 dark:text-slate-100">বিকল্প অভিভাবকের তথ্য (পিতা-মাতা ছাড়া)</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label="অভিভাবকের নাম (বাংলা)"
          name="alt_guardian_name"
          value={student.alt_guardian_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="bn"
        />
        <Field
          label="অভিভাবকের নাম (আরবি)"
          name="alt_guardian_arabic_name"
          value={student.alt_guardian_arabic_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="ar"
        />
        <Field
          label="অভিভাবকের নাম (ইংরেজি)"
          name="alt_guardian_name_en"
          value={student.alt_guardian_name_en}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          scriptLang="en"
        />
        <Field
          label="ছাত্রের সাথে সম্পর্ক"
          name="alt_guardian_relation"
          value={student.alt_guardian_relation}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />
        <Field
          label="মোবাইল নম্বর"
          name="alt_guardian_phone"
          value={student.alt_guardian_phone}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
          numeric
        />
        <Field
          label="ঠিকানা"
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
