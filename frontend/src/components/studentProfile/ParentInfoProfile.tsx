import Field from "./Field";

const ParentInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode, // ✅ added
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6">
      <h2 className="text-xl mb-4">অভিভাবকের তথ্য</h2>

      <div className="grid grid-cols-4 gap-4">
        <Field
          label="পিতার নাম"
          name="father_name"
          value={student.father_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="পিতার আরবি নাম"
          name="father_arabic_name"
          value={student.father_arabic_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="পিতার NID"
          name="father_nid"
          value={student.father_nid}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="পিতার পেশা"
          name="father_name"
          value={student.father_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="মাতার নাম"
          name="mother_name"
          value={student.mother_name}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />
        <Field
          label="মাতার NID"
          name="mother_nid"
          value={student.mother_nid}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
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
        />
      </div>
    </div>
  );
};

export default ParentInfoProfile;
