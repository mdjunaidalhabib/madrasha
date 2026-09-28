import { useEffect, useState } from "react";
import Field from "./Field";
import CustomDatePicker from "@madrasha/shared-ui/src/components/ui/CustomDatePicker";
import ExperiencePicker from "../../components/ExperiencePicker/ExperiencePicker";
import api, { cachedGet } from "../../services/api";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { localizeDigits, useLang } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../../features/teachers/teacherStaff.text";

const TeacherInfoProfile = ({
  data,
  handleChange,
  setFormData,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const t = useText(teacherStaffText);
  const lang = useLang();
  const isMadrasa = useIsMadrasa();
  const [divisions, setDivisions] = useState<any[]>([]);

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await cachedGet("/madrasa-divisions");
        const list = res.data?.data || res.data?.result || res.data || [];
        setDivisions(Array.isArray(list) ? list : []);
      } catch (err) {
        logger.error("Division load error:", err);
        setDivisions([]);
      }
    };

    fetchDivisions();
  }, []);

  /* =============================
     AGE CALC (SAFE)
  ============================= */
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
      setFormData((prev: any) => ({
        ...prev,
        age,
      }));
    }
  }, [data?.dob, data?.age, setFormData]);

  /* =============================
     EXPERIENCE FORMAT (VIEW)
  ============================= */
  const formatExperience = (y?: string, m?: string) => {
    const year = Number(y || 0);
    const month = Number(m || 0);

    if (!year && !month) return t.years(localizeDigits(0, lang));
    if (!year) return t.months(localizeDigits(month, lang));
    if (!month) return t.years(localizeDigits(year, lang));
    return t.yearsMonths(localizeDigits(year, lang), localizeDigits(month, lang));
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl mb-4 font-semibold text-gray-700 border-b pb-2 dark:text-slate-200 dark:border-slate-700">{t.teacherInfo}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NAME BN */}
        <Field
          label={t.nameBn}
          name="name_bn"
          value={data?.name_bn || ""}
          onChange={handleChange}
          scriptLang="bn"
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* NAME AR */}
        {isMadrasa && (
          <Field
            label={t.nameAr}
            name="name_ar"
            value={data?.name_ar || ""}
            onChange={handleChange}
            scriptLang="ar"
            {...{ editableField, setEditableField, isEditMode }}
          />
        )}

        {/* NAME EN */}
        <Field
          label={t.nameEn}
          name="name_en"
          value={data?.name_en || ""}
          onChange={handleChange}
          scriptLang="en"
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* NID */}
        <Field
          label="NID"
          name="nid"
          value={data?.nid || ""}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* GENDER */}
        <Field
          label={t.fields.gender}
          name="gender"
          value={data?.gender ?? ""}
          type="select"
          options={[
            { label: t.male, value: "1" },
            { label: t.female, value: "2" },
          ]}
          onChange={handleChange}
          {...{ isEditMode }}
        />

        {/* DOB */}
        <CustomDatePicker
          label={t.fields.dob}
          value={data?.dob || ""}
          isEditMode={isEditMode}
          onChange={(date) => setFormData((prev: any) => ({ ...prev, dob: date }))}
        />

        {/* AGE */}
        <Field label={t.fields.age} name="age" value={data?.age || ""} />

        {/* PHONE */}
        <Field
          label={t.fields.mobile}
          name="phone"
          value={data?.phone || ""}
          onChange={handleChange}
          numeric
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* EMAIL */}
        <Field
          label={t.fields.email}
          name="email"
          value={data?.email || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* DESIGNATION */}
        <Field
          label={t.fields.designation}
          name="designation"
          value={data?.designation || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* ACADEMIC DIVISION */}
        <Field
          label={t.fields.academic_division}
          name="academic_division"
          value={data?.academic_division || data?.division_id || data?.department || ""}
          type="select"
          options={divisions.map((division) => ({
            label: division.division_name_bn,
            value: String(division.division_id),
          }))}
          onChange={handleChange}
          {...{ isEditMode }}
        />

        {/* QUALIFICATION */}
        <Field
          label={t.fields.qualification}
          name="qualification"
          value={data?.qualification || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />

        {/* =========================
           EXPERIENCE (FIXED)
        ========================= */}
        {isEditMode ? (
          <ExperiencePicker
            label={t.experience}
            year={data?.experience_year || ""}
            month={data?.experience_month || ""}
            onChange={(year, month) =>
              setFormData((prev: any) => ({
                ...prev,
                experience_year: year,
                experience_month: month,
              }))
            }
          />
        ) : (
          <Field
            label={t.experience}
            name="experience"
            value={formatExperience(data?.experience_year, data?.experience_month)}
          />
        )}

        {/* JOINING DATE */}
        <CustomDatePicker
          label={t.fields.joining_date}
          value={data?.joining_date || ""}
          isEditMode={isEditMode}
          onChange={(date) =>
            setFormData((prev: any) => ({
              ...prev,
              joining_date: date,
            }))
          }
        />

        {/* SALARY */}
        <Field
          label={t.fields.salary}
          name="salary"
          value={data?.salary || ""}
          onChange={handleChange}
          {...{ editableField, setEditableField, isEditMode }}
        />
      </div>
    </div>
  );
};

export default TeacherInfoProfile;
