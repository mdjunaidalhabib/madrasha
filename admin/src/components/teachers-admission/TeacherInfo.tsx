import React, { useEffect } from "react";
import { TeacherFormData, TeacherFormErrors } from "../../features/teachers/TeacherPage";
import CustomDatePicker from "@madrasha/shared-ui/src/components/ui/CustomDatePicker";
import ExperiencePicker from "../../components/ExperiencePicker/ExperiencePicker";
import NumericInput from "@madrasha/shared-ui/src/components/ui/NumericInput";
import ScriptInput from "@madrasha/shared-ui/src/components/ui/ScriptInput";
import { commonText, useText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

interface DivisionItem {
  division_id: number;
  division_name_bn: string;
}

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
  errors?: TeacherFormErrors;
  setErrors?: React.Dispatch<React.SetStateAction<TeacherFormErrors>>;
  divisions?: DivisionItem[];
}

const TeacherInfo: React.FC<Props> = ({
  formData,
  setFormData,
  errors = {},
  setErrors,
  divisions = [],
}) => {
  const t = useText(teacherStaffText);
  const c = useText(commonText);
  const isMadrasa = useIsMadrasa();
  const inputClass = (field: keyof TeacherFormData) =>
    `border rounded-lg px-3 py-2 outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
      errors[field]
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-300 focus:ring-green-500 dark:border-slate-700"
    }`;

  const ErrorText = ({ field }: { field: keyof TeacherFormData }) =>
    errors[field] ? <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors[field]}</p> : null;

  const clearError = (field: keyof TeacherFormData) => {
    if (!setErrors) return;
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "gender" ? (value === "" ? null : Number(value)) : value,
    }));

    clearError(name as keyof TeacherFormData);
  };

  /* AGE CALC */
  useEffect(() => {
    if (!formData.dob) return;

    const birthDate = new Date(formData.dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    setFormData((prev) => ({
      ...prev,
      age,
    }));
  }, [formData.dob, setFormData]);

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3 dark:text-slate-100 dark:border-slate-700">{t.teacherInfo}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* নাম (বাংলা) */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            {t.nameBn} <span className="text-red-500">*</span>
          </label>
          <ScriptInput
            scriptLang="bn"
            name="name_bn"
            value={formData.name_bn || ""}
            onChange={handleChange}
            className={inputClass("name_bn")}
          />
          <ErrorText field="name_bn" />
        </div>

        {/* নাম (আরবি) */}
        {isMadrasa && (
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.nameAr}</label>
            <ScriptInput
              scriptLang="ar"
              name="name_ar"
              value={formData.name_ar || ""}
              onChange={handleChange}
              placeholder="اسم المدرس"
              className={inputClass("name_ar")}
            />
          </div>
        )}

        {/* নাম (ইংরেজি) */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.nameEn}</label>
          <ScriptInput
            scriptLang="en"
            name="name_en"
            value={formData.name_en || ""}
            onChange={handleChange}
            placeholder="Teacher's Name"
            className={inputClass("name_en")}
          />
        </div>

        {/* NID */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">NID</label>
          <NumericInput
            name="nid"
            value={formData.nid || ""}
            onChange={handleChange}
            className={inputClass("nid")}
          />
        </div>

        {/* লিঙ্গ */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fields.gender}</label>
          <select
            name="gender"
            value={formData.gender ?? ""}
            onChange={handleChange}
            className={inputClass("gender")}
          >
            <option value="">{c.select}</option>
            <option value={1}>{t.male}</option>
            <option value={2}>{t.female}</option>
          </select>
        </div>

        {/* জন্ম তারিখ */}
        <CustomDatePicker
          label={t.fields.dob}
          value={formData.dob || ""}
          onChange={(date) =>
            setFormData((prev) => ({
              ...prev,
              dob: date,
            }))
          }
        />

        {/* বয়স */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fields.age}</label>
          <input
            value={formData.age ?? ""}
            readOnly
            className="border rounded-lg px-3 py-2 bg-gray-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          />
        </div>

        {/* মোবাইল */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fields.mobile}</label>
          <NumericInput
            name="phone"
            value={formData.phone || ""}
            onChange={handleChange}
            className={inputClass("phone")}
          />
          <ErrorText field="phone" />
        </div>

        {/* ইমেইল */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fields.email}</label>
          <input
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            className={inputClass("email")}
          />
        </div>

        {/* পদবি */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fields.designation}</label>
          <input
            name="designation"
            value={formData.designation || ""}
            onChange={handleChange}
            className={inputClass("designation")}
          />
        </div>

        {/* ACADEMIC DIVISION */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            {t.fields.academic_division} <span className="text-red-500">*</span>
          </label>
          <select
            name="academic_division"
            value={formData.academic_division || ""}
            onChange={handleChange}
            className={inputClass("academic_division")}
          >
            <option value="">{c.select}</option>
            {divisions.map((division) => (
              <option key={division.division_id} value={division.division_id}>
                {division.division_name_bn}
              </option>
            ))}
          </select>
          <ErrorText field="academic_division" />
        </div>

        {/* যোগ্যতা */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.educationalQualification}</label>
          <input
            name="qualification"
            value={formData.qualification || ""}
            onChange={handleChange}
            className={inputClass("qualification")}
          />
        </div>

        {/* অভিজ্ঞতা */}
        <ExperiencePicker
          label={t.experience}
          year={formData.experience_year || ""}
          month={formData.experience_month || ""}
          onChange={(year, month) =>
            setFormData((prev) => ({
              ...prev,
              experience_year: year,
              experience_month: month,
            }))
          }
        />

        {/* যোগদানের তারিখ */}
        <CustomDatePicker
          label={t.fields.joining_date}
          value={formData.joining_date || ""}
          onChange={(date) =>
            setFormData((prev) => ({
              ...prev,
              joining_date: date,
            }))
          }
        />

        {/* বেতন */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fields.salary}</label>
          <input
            name="salary"
            value={formData.salary || ""}
            onChange={handleChange}
            className={inputClass("salary")}
          />
        </div>
      </div>
    </div>
  );
};

export default TeacherInfo;
