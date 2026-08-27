import { StaffFormData } from "../../features/staff/StaffPage";
import ScriptInput from "../ui/ScriptInput";
import NumericInput from "../ui/NumericInput";

interface Props {
  formData: StaffFormData;
  setFormData: React.Dispatch<React.SetStateAction<StaffFormData>>;
}

const StaffParentInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3 dark:text-slate-100 dark:border-slate-700">পারিবারিক তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পিতার নাম (বাংলা)</label>
          <ScriptInput
            scriptLang="bn"
            name="father_name"
            value={formData.father_name || ""}
            onChange={handleChange}
            placeholder="পিতার নাম লিখুন"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পিতার নাম (আরবি)</label>
          <ScriptInput
            scriptLang="ar"
            name="father_name_ar"
            value={formData.father_name_ar || ""}
            onChange={handleChange}
            placeholder="الأب اسم"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পিতার নাম (ইংরেজি)</label>
          <ScriptInput
            scriptLang="en"
            name="father_name_en"
            value={formData.father_name_en || ""}
            onChange={handleChange}
            placeholder="Father's Name"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পিতার NID</label>
          <NumericInput
            name="father_nid"
            value={formData.father_nid || ""}
            onChange={handleChange}
            placeholder="পিতার NID নম্বর"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পিতার পেশা</label>
          <input
            name="father_occupation"
            value={formData.father_occupation || ""}
            onChange={handleChange}
            placeholder="পিতার পেশা"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">মাতার নাম (বাংলা)</label>
          <ScriptInput
            scriptLang="bn"
            name="mother_name"
            value={formData.mother_name || ""}
            onChange={handleChange}
            placeholder="মাতার নাম লিখুন"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">মাতার নাম (আরবি)</label>
          <ScriptInput
            scriptLang="ar"
            name="mother_name_ar"
            value={formData.mother_name_ar || ""}
            onChange={handleChange}
            placeholder="الأم اسم"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">মাতার নাম (ইংরেজি)</label>
          <ScriptInput
            scriptLang="en"
            name="mother_name_en"
            value={formData.mother_name_en || ""}
            onChange={handleChange}
            placeholder="Mother's Name"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">মাতার NID</label>
          <NumericInput
            name="mother_nid"
            value={formData.mother_nid || ""}
            onChange={handleChange}
            placeholder="মাতার NID নম্বর"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">মাতার পেশা</label>
          <input
            name="mother_occupation"
            value={formData.mother_occupation || ""}
            onChange={handleChange}
            placeholder="মাতার পেশা"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">অভিভাবকের মোবাইল নম্বর</label>
          <NumericInput
            name="parent_phone"
            value={formData.parent_phone || ""}
            onChange={handleChange}
            placeholder="মোবাইল নম্বর"
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>
    </div>
  );
};

export default StaffParentInfo;
