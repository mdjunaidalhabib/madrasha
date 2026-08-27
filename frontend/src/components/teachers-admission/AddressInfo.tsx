import { TeacherFormData } from "../../features/teachers/TeacherPage";
import AddressCascadeFields, { AddressField } from "../ui/AddressCascadeFields";

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
}

const addressSelectClass =
  "border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const AddressInfo: React.FC<Props> = ({ formData, setFormData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddressChange = (field: AddressField, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3 dark:text-slate-100 dark:border-slate-700">ঠিকানার তথ্য</h2>

      {/* 4 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <AddressCascadeFields
          values={{ division: formData.division || "", district: formData.district || "", thana: formData.thana || "" }}
          onChange={handleAddressChange}
          selectClassName={addressSelectClass}
        />

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
