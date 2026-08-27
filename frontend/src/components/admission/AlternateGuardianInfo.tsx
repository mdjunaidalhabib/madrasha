import { AdmissionFormData } from "../../features/students/AdmissionPage";
import ScriptInput from "../ui/ScriptInput";
import NumericInput from "../ui/NumericInput";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

const inputClass =
  "border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const AlternateGuardianInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6 dark:bg-slate-900 dark:border-slate-700">
      <div className="flex items-center justify-between border-b pb-3 mb-6 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-100">বিকল্প অভিভাবক (পিতা-মাতা ছাড়া)</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.hasAltGuardian}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, hasAltGuardian: e.target.checked }))
            }
            className="w-4 h-4 accent-green-600"
          />
          <span className="text-sm font-medium text-gray-600 dark:text-slate-400">পিতা-মাতা ছাড়া অন্য অভিভাবক আছে</span>
        </label>
      </div>

      {formData.hasAltGuardian && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">অভিভাবকের নাম (বাংলা)</label>
            <ScriptInput
              scriptLang="bn"
              name="altGuardianName"
              value={formData.altGuardianName || ""}
              onChange={handleChange}
              placeholder="নাম লিখুন"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">অভিভাবকের নাম (আরবি)</label>
            <ScriptInput
              scriptLang="ar"
              name="altGuardianArabicName"
              value={formData.altGuardianArabicName || ""}
              onChange={handleChange}
              placeholder="اسم ولي الأمر"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">অভিভাবকের নাম (ইংরেজি)</label>
            <ScriptInput
              scriptLang="en"
              name="altGuardianNameEn"
              value={formData.altGuardianNameEn || ""}
              onChange={handleChange}
              placeholder="Guardian's Name"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
              ছাত্রের সাথে সম্পর্ক
            </label>
            <input
              name="altGuardianRelation"
              value={formData.altGuardianRelation || ""}
              onChange={handleChange}
              placeholder="যেমন: চাচা, দাদা"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">মোবাইল নম্বর</label>
            <NumericInput
              name="altGuardianPhone"
              value={formData.altGuardianPhone || ""}
              onChange={handleChange}
              placeholder="মোবাইল নম্বর"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">ঠিকানা</label>
            <input
              name="altGuardianAddress"
              value={formData.altGuardianAddress || ""}
              onChange={handleChange}
              placeholder="ঠিকানা"
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AlternateGuardianInfo;
