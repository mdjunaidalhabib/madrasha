import Field from "./Field";

const TeacherParentInfoProfile = ({
  data,
  handleChange,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6">
      <h2 className="text-xl mb-4">পারিবারিক তথ্য</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label="পিতার নাম"
          name="father_name"
          value={data.father_name}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="পিতার NID"
          name="father_nid"
          value={data.father_nid}
          onChange={handleChange}
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
          label="মাতার নাম"
          name="mother_name"
          value={data.mother_name}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="মাতার NID"
          name="mother_nid"
          value={data.mother_nid}
          onChange={handleChange}
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
          {...{ editableField, setEditableField, isEditMode }}
        />
      </div>
    </div>
  );
};

export default TeacherParentInfoProfile;
