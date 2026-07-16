import Field from "./Field";

const AddressInfoProfile = ({
  student,
  handleChange,
  editableField,
  setEditableField,
  isEditMode, // ✅ added
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6">
      <h2 className="text-xl mb-4">ঠিকানার তথ্য</h2>

      <div className="grid grid-cols-4 gap-4">
        <Field
          label="বিভাগ"
          name="division"
          value={student.division}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />

        <Field
          label="জেলা"
          name="district"
          value={student.district}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />

        <Field
          label="থানা"
          name="thana"
          value={student.thana}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode} // ✅ pass
        />

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
