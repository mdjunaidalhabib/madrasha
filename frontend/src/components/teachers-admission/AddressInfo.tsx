import { TeacherFormData } from "../../features/teachers/TeacherPage";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

const AddressInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3 dark:text-slate-100 dark:border-slate-700">ঠিকানার তথ্য</h2>

      {/* 4 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Division */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">বিভাগ</label>
          <input
            name="division"
            value={formData.division || ""}
            onChange={handleChange}
            placeholder="বিভাগ"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* District */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">জেলা</label>
          <input
            name="district"
            value={formData.district || ""}
            onChange={handleChange}
            placeholder="জেলা"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Thana */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">থানা / উপজেলা</label>
          <input
            name="thana"
            value={formData.thana || ""}
            onChange={handleChange}
            placeholder="থানা / উপজেলা"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Village */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">গ্রাম</label>
          <input
            name="village"
            value={formData.village || ""}
            onChange={handleChange}
            placeholder="গ্রাম"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>
    </div>
  );
};

export default AddressInfo;
