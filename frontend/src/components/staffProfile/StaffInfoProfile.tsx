import { useEffect } from "react";
import Field from "../teacherProfile/Field";
import CustomDatePicker from "../../components/CustomDatePicker/CustomDatePicker";
import ExperiencePicker from "../../components/ExperiencePicker/ExperiencePicker";

const StaffInfoProfile = ({
  data,
  handleChange,
  setFormData,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  /* AGE CALC (SAFE) */
  useEffect(() => {
    if (!data?.dob) return;

    const d = new Date(data.dob);
    const today = new Date();

    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }

    if (Number(data.age) !== age) {
      setFormData((prev: any) => ({ ...prev, age }));
    }
  }, [data?.dob, data?.age, setFormData]);

  const formatExperience = (y?: string, m?: string) => {
    const year = Number(y || 0);
    const month = Number(m || 0);

    if (!year && !month) return "0 বছর";
    if (!year) return `${month} মাস`;
    if (!month) return `${year} বছর`;
    return `${year} বছর ${month} মাস`;
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 font-semibold text-gray-700 border-b pb-2 dark:text-slate-200 dark:border-slate-700">স্টাফের তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label="নাম (বাংলা)"
          name="name_bn"
          value={data?.name_bn || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="নাম (আরবি)"
          name="name_ar"
          value={data?.name_ar || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="NID"
          name="nid"
          value={data?.nid || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="লিঙ্গ"
          name="gender"
          value={data?.gender ?? ""}
          type="select"
          options={[
            { label: "পুরুষ", value: "1" },
            { label: "মহিলা", value: "2" },
          ]}
          onChange={handleChange}
          {...{ isEditMode }}
        />

        <CustomDatePicker
          label="জন্ম তারিখ"
          value={data?.dob || ""}
          isEditMode={isEditMode}
          onChange={(date) => setFormData((prev: any) => ({ ...prev, dob: date }))}
        />

        <Field label="বয়স" name="age" value={data?.age || ""} />

        <Field
          label="মোবাইল"
          name="phone"
          value={data?.phone || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="ইমেইল"
          name="email"
          value={data?.email || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="পদবি"
          name="designation"
          value={data?.designation || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="বিভাগ (পদ)"
          name="department"
          value={data?.department || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        <Field
          label="যোগ্যতা"
          name="qualification"
          value={data?.qualification || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        {isEditMode ? (
          <ExperiencePicker
            label="অভিজ্ঞতা"
            year={data?.experience_year || ""}
            month={data?.experience_month || ""}
            onChange={(year, month) =>
              setFormData((prev: any) => ({ ...prev, experience_year: year, experience_month: month }))
            }
          />
        ) : (
          <Field
            label="অভিজ্ঞতা"
            name="experience"
            value={formatExperience(data?.experience_year, data?.experience_month)}
          />
        )}

        <CustomDatePicker
          label="যোগদানের তারিখ"
          value={data?.joining_date || ""}
          isEditMode={isEditMode}
          onChange={(date) => setFormData((prev: any) => ({ ...prev, joining_date: date }))}
        />

        <Field
          label="বেতন"
          name="salary"
          value={data?.salary || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />
      </div>
    </div>
  );
};

export default StaffInfoProfile;
