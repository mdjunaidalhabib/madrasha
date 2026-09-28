import { AdmissionFormData } from "../../features/students/AdmissionPage";

import { useText, commonText } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "./admission.text";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const OtherInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const t = useText(admissionText);
  const c = useText(commonText);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "residencyType" ? (value === "" ? null : Number(value)) : value,
    }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3 dark:text-slate-200 dark:border-slate-700">{t.otherInfo}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.bloodGroup}</label>
          <select
            name="bloodGroup"
            value={formData.bloodGroup || ""}
            onChange={handleChange}
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{c.select}</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.residency}</label>
          <select
            name="residencyType"
            value={formData.residencyType ?? ""}
            onChange={handleChange}
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">{c.select}</option>
            <option value={1}>{t.residential}</option>
            <option value={2}>{t.nonResidential}</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.orphan}</label>
          <select
            name="isOrphan"
            value={formData.isOrphan ? "yes" : "no"}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, isOrphan: e.target.value === "yes" }))
            }
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="no">{c.no}</option>
            <option value="yes">{c.yes}</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default OtherInfo;
