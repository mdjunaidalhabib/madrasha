import Field from "./Field";

const TeacherAddressProfile = ({
  data,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6">
      <h2 className="text-xl mb-4">ঠিকানার তথ্য</h2>

      <div className="grid grid-cols-4 gap-4">
        <Field
          label="বিভাগ"
          name="division"
          value={data.division}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="জেলা"
          name="district"
          value={data.district}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="থানা"
          name="thana"
          value={data.thana}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="গ্রাম"
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
