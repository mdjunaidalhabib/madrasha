import { AdmissionFormData } from "../../features/students/AdmissionPage";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const OtherInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "residencyType" ? (value === "" ? null : Number(value)) : value,
    }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3">অন্যান্য তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">রক্তের গ্রুপ</label>
          <select
            name="bloodGroup"
            value={formData.bloodGroup || ""}
            onChange={handleChange}
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300"
          >
            <option value="">নির্বাচন করুন</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">আবাসিক/অনাবাসিক</label>
          <select
            name="residencyType"
            value={formData.residencyType ?? ""}
            onChange={handleChange}
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300"
          >
            <option value="">নির্বাচন করুন</option>
            <option value={1}>আবাসিক</option>
            <option value={2}>অনাবাসিক</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">এতিম শিক্ষার্থী</label>
          <select
            name="isOrphan"
            value={formData.isOrphan ? "yes" : "no"}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, isOrphan: e.target.value === "yes" }))
            }
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 border-gray-300"
          >
            <option value="no">না</option>
            <option value="yes">হ্যাঁ</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default OtherInfo;
