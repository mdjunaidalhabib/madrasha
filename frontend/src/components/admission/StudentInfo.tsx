import { AdmissionFormData, AdmissionFormErrors } from "../../features/students/AdmissionPage";
import { useEffect, useState } from "react";
import api, { cachedGet } from "../../services/api";
import CustomDatePicker from "../../components/CustomDatePicker/CustomDatePicker";
import { logger } from "../../utils/logger";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  errors: AdmissionFormErrors;
  setErrors: React.Dispatch<React.SetStateAction<AdmissionFormErrors>>;
}

interface Division {
  division_id: number;
  division_name_bn: string;
}

interface ClassItem {
  class_id: number;
  class_name_bn: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = Array.from({ length: 8 }, (_, index) => String(CURRENT_YEAR - 4 + index));

const StudentInfo: React.FC<Props> = ({ formData, setFormData, errors, setErrors }) => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

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

  const extractData = (res: any) => res?.data?.data || res?.data?.result || res?.data || [];

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob + "T00:00:00");
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const isValidDate = (date: string) => {
    const d = new Date(date);
    return !isNaN(d.getTime());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const field = name as keyof AdmissionFormData;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === "gender" ? (value === "" ? null : Number(value)) : value,
      };

      if (name === "academicDivision") {
        updated.previousClass = "";
        updated.currentClass = "";
      }

      if (name === "academicDivision" || name === "currentClass" || name === "academicYear") {
        updated.roll = "";
      }

      return updated;
    });

    clearError(field);

    if (name === "academicDivision") {
      setClasses([]);
      clearError("currentClass");
    }
  };

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await cachedGet("/madrasa-divisions");
        const data = extractData(res);
        setDivisions(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("Division load error:", err);
        setDivisions([]);
      }
    };

    fetchDivisions();
  }, []);

  useEffect(() => {
    if (!formData.academicDivision) {
      setClasses([]);
      return;
    }

    const controller = new AbortController();

    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);

        const res = await cachedGet(`/madrasa-classes?division_id=${formData.academicDivision}`, {
          signal: controller.signal,
        });

        const data = extractData(res);
        setClasses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err?.name !== "CanceledError") {
          logger.error("Class load error:", err);
        }
        setClasses([]);
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();

    return () => controller.abort();
  }, [formData.academicDivision]);

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3">ছাত্রের তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            ছাত্রের নাম <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            className={inputClass("name")}
          />
          <ErrorText field="name" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">আরবি নাম</label>
          <input
            name="arabicName"
            value={formData.arabicName || ""}
            onChange={handleChange}
            className={inputClass("arabicName")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">NID</label>
          <input
            name="nid"
            value={formData.nid || ""}
            onChange={handleChange}
            className={inputClass("nid")}
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-600">রোল নম্বর</label>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              স্বয়ংক্রিয়
            </span>
          </div>

          <input
            type="text"
            value={formData.roll || ""}
            placeholder="শ্রেণি নির্বাচন করলে সম্ভাব্য রোল দেখা যাবে"
            readOnly
            aria-readonly="true"
            className={`${inputClass("roll")} cursor-not-allowed bg-gray-100 text-gray-700`}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">লিঙ্গ</label>
          <select
            name="gender"
            value={formData.gender ?? ""}
            onChange={handleChange}
            className={inputClass("gender")}
          >
            <option value="">নির্বাচন করুন</option>
            <option value={1}>ছেলে</option>
            <option value={2}>মেয়ে</option>
          </select>
        </div>

        <div>
          <CustomDatePicker
            label="জন্ম তারিখ"
            value={formData.dob || ""}
            onChange={(date) => {
              setFormData((prev) => ({
                ...prev,
                dob: date,
                age: isValidDate(date) ? calculateAge(date) : null,
              }));

              clearError("dob");
            }}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">বয়স</label>
          <input
            name="age"
            value={formData.age || ""}
            readOnly
            className="border rounded-lg px-3 py-2 bg-gray-100 text-gray-500"
          />
        </div>

        {/* শিক্ষাবর্ষ */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            শিক্ষাবর্ষ <span className="text-red-500">*</span>
          </label>
          <select
            name="academicYear"
            value={formData.academicYear || ""}
            onChange={handleChange}
            className={inputClass("academicYear")}
          >
            <option value="">নির্বাচন করুন</option>
            {ACADEMIC_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ErrorText field="academicYear" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            বিভাগ <span className="text-red-500">*</span>
          </label>

          <select
            name="academicDivision"
            value={formData.academicDivision || ""}
            onChange={handleChange}
            className={inputClass("academicDivision")}
          >
            <option value="">নির্বাচন করুন</option>
            {divisions.map((d) => (
              <option key={d.division_id} value={d.division_id}>
                {d.division_name_bn}
              </option>
            ))}
          </select>

          <ErrorText field="academicDivision" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">পূর্বের শ্রেণি</label>
          <select
            name="previousClass"
            value={formData.previousClass || ""}
            onChange={handleChange}
            disabled={!classes.length || loadingClasses}
            className={inputClass("previousClass")}
          >
            <option value="">{loadingClasses ? "লোড হচ্ছে..." : "নির্বাচন করুন"}</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name_bn}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1">
            বর্তমান শ্রেণি <span className="text-red-500">*</span>
          </label>
          <select
            name="currentClass"
            value={formData.currentClass || ""}
            onChange={handleChange}
            disabled={!classes.length || loadingClasses}
            className={inputClass("currentClass")}
          >
            <option value="">{loadingClasses ? "লোড হচ্ছে..." : "নির্বাচন করুন"}</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name_bn}
              </option>
            ))}
          </select>
          <ErrorText field="currentClass" />
        </div>
      </div>
    </div>
  );
};

export default StudentInfo;
