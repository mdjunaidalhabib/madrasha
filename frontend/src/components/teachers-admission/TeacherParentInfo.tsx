import { TeacherFormData } from "../../features/teachers/TeacherPage";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

const ParentInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3">পারিবারিক তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Father's Name */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার নাম</label>
          <input
            name="father_name"
            value={formData.father_name || ""}
            onChange={handleChange}
            placeholder="পিতার নাম লিখুন"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Father's Arabic Name */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার আরবি নাম</label>
          <input
            name="father_name_ar"
            value={formData.father_name_ar || ""}
            onChange={handleChange}
            placeholder="পিতার আরবি নাম"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Father's NID */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার NID</label>
          <input
            name="father_nid"
            value={formData.father_nid || ""}
            onChange={handleChange}
            placeholder="পিতার NID নম্বর"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Father's Occupation */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার পেশা</label>
          <input
            name="father_occupation"
            value={formData.father_occupation || ""}
            onChange={handleChange}
            placeholder="পিতার পেশা"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Mother's Name */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">মাতার নাম</label>
          <input
            name="mother_name"
            value={formData.mother_name || ""}
            onChange={handleChange}
            placeholder="মাতার নাম লিখুন"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Mother's NID */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">মাতার NID</label>
          <input
            name="mother_nid"
            value={formData.mother_nid || ""}
            onChange={handleChange}
            placeholder="মাতার NID নম্বর"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Mother's Occupation */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">মাতার পেশা</label>
          <input
            name="mother_occupation"
            value={formData.mother_occupation || ""}
            onChange={handleChange}
            placeholder="মাতার পেশা"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Parent Phone */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">অভিভাবকের মোবাইল নম্বর</label>
          <input
            name="parent_phone"
            value={formData.parent_phone || ""}
            onChange={handleChange}
            placeholder="মোবাইল নম্বর"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>
    </div>
  );
};

export default ParentInfo;
