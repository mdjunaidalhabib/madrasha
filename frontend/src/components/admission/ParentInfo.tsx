import { AdmissionFormData, AdmissionFormErrors } from "../../features/students/AdmissionPage";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  errors: AdmissionFormErrors;
  setErrors: React.Dispatch<React.SetStateAction<AdmissionFormErrors>>;
}

const ParentInfo: React.FC<Props> = ({ formData, setFormData, errors, setErrors }) => {
  const inputClass = (field: keyof AdmissionFormData) =>
    `border rounded-lg px-3 py-2 outline-none focus:ring-2 ${
      errors[field] ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-green-500"
    }`;

  const ErrorText = ({ field }: { field: keyof AdmissionFormData }) =>
    errors[field] ? <p className="text-red-500 text-xs mt-1">{errors[field]}</p> : null;

  const clearError = (field: keyof AdmissionFormData) => {
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof AdmissionFormData;

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    clearError(field);
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3">অভিভাবকের তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার নাম</label>
          <input
            name="fatherName"
            value={formData.fatherName || ""}
            onChange={handleChange}
            placeholder="পিতার নাম লিখুন"
            className={inputClass("fatherName")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার আরবি নাম</label>
          <input
            name="fatherArabicName"
            value={formData.fatherArabicName || ""}
            onChange={handleChange}
            placeholder="পিতার আরবি নাম"
            className={inputClass("fatherArabicName")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার NID</label>
          <input
            name="fatherNid"
            value={formData.fatherNid || ""}
            onChange={handleChange}
            placeholder="পিতার NID নম্বর"
            className={inputClass("fatherNid")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পিতার পেশা</label>
          <input
            name="fatherOccupation"
            value={formData.fatherOccupation || ""}
            onChange={handleChange}
            placeholder="পিতার পেশা"
            className={inputClass("fatherOccupation")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">মাতার নাম</label>
          <input
            name="motherName"
            value={formData.motherName || ""}
            onChange={handleChange}
            placeholder="মাতার নাম লিখুন"
            className={inputClass("motherName")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">মাতার NID</label>
          <input
            name="motherNid"
            value={formData.motherNid || ""}
            onChange={handleChange}
            placeholder="মাতার NID নম্বর"
            className={inputClass("motherNid")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">মাতার পেশা</label>
          <input
            name="motherOccupation"
            value={formData.motherOccupation || ""}
            onChange={handleChange}
            placeholder="মাতার পেশা"
            className={inputClass("motherOccupation")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">অভিভাবকের মোবাইল নম্বর</label>
          <input
            name="parentPhone"
            value={formData.parentPhone || ""}
            onChange={handleChange}
            placeholder="মোবাইল নম্বর"
            className={inputClass("parentPhone")}
          />
        </div>
      </div>
    </div>
  );
};

export default ParentInfo;
