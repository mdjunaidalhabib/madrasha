import { useEffect, useState } from "react";
import Field from "./Field";
import api from "../../services/api";
import CustomDatePicker from "../../components/CustomDatePicker/CustomDatePicker";
import { logger } from "../../utils/logger";

/* =============================
   TYPES
============================= */
type Division = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
};

const StudentInfoProfile = ({
  student,
  handleChange,
  setStudent,
  editableField,
  setEditableField,
  isEditMode,
}: any) => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await api.get("/madrasa-divisions");
        const data = res.data?.data || res.data?.result || res.data || [];
        setDivisions(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("Division load error:", err);
        setDivisions([]);
      }
    };

    fetchDivisions();
  }, []);

  useEffect(() => {
    const divisionId = student.division_id || student.academicDivision;
    if (!divisionId) return;

    const fetchClasses = async () => {
      try {
        const res = await api.get(`/madrasa-classes?division_id=${divisionId}`);
        const data = res.data?.data || res.data?.result || res.data || [];
        setClasses(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("Class load error:", err);
        setClasses([]);
      }
    };

    fetchClasses();
  }, [student.division_id, student.academicDivision]);

  useEffect(() => {
    if (!student?.dob) return;

    const d = new Date(student.dob);
    const today = new Date();

    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }

    setStudent((prev: any) => ({
      ...prev,
      age,
    }));
  }, [student.dob]);

  useEffect(() => {
    if (!student) return;

    setStudent((prev: any) => ({
      ...prev,
      division_id: prev.division_id || prev.academicDivision,
      class_id: prev.class_id || prev.currentClass,
      previous_class_id: prev.previous_class_id || prev.previousClass,
    }));
  }, []);

  const getGenderName = (gender: any) => {
    if (gender == 1) return "পুরুষ";
    if (gender == 2) return "মহিলা";
    return "N/A";
  };

  const getDivisionName = (id: any) => {
    const div = divisions.find((d) => d.division_id == id);
    return div?.division_name_bn || "N/A";
  };

  const getClassName = (id: any) => {
    const cls = classes.find((c) => c.class_id == id);
    return cls?.class_name_bn || "N/A";
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border mt-6">
      <h2 className="text-xl mb-4">ছাত্রের তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field
          label="নাম"
          name="name_bn"
          value={student.name_bn || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />

        <Field label="রেজিস্ট্রেশন নম্বর" name="id" value={student.id || ""} isEditMode={false} />

        <Field
          label="রোল নম্বর"
          name="roll"
          type="number"
          value={student.roll || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />

        <Field
          label="ছাত্রের আরবি নাম"
          name="arabic_name"
          value={student.arabic_name || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />

        <Field
          label="ছাত্রের NID"
          name="nid"
          value={student.nid || ""}
          onChange={handleChange}
          editableField={editableField}
          setEditableField={setEditableField}
          isEditMode={isEditMode}
        />

        {/* GENDER */}
        <div>
          <label className="text-sm text-gray-500">লিঙ্গ</label>

          {isEditMode ? (
            <select
              name="gender"
              value={student.gender ?? ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            >
              <option value="">লিঙ্গ নির্বাচন করুন</option>
              <option value={1}>পুরুষ</option>
              <option value={2}>মহিলা</option>
            </select>
          ) : (
            <p className="border p-2 rounded bg-gray-100">{getGenderName(student.gender)}</p>
          )}
        </div>

        <CustomDatePicker
          label="জন্ম তারিখ"
          value={student.dob}
          isEditMode={isEditMode}
          onChange={(date) =>
            setStudent((prev: any) => ({
              ...prev,
              dob: date,
            }))
          }
        />

        <Field label="বয়স" name="age" value={student.age || ""} isEditMode={false} />

        {/* DIVISION */}
        <div>
          <label className="text-sm text-gray-500">বিভাগ</label>

          {isEditMode ? (
            <select
              name="division_id"
              value={student.division_id || student.academicDivision || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
          ) : (
            <p className="border p-2 rounded bg-gray-100">
              {getDivisionName(student.division_id || student.academicDivision)}
            </p>
          )}
        </div>

        {/* PREVIOUS CLASS */}
        <div>
          <label className="text-sm text-gray-500">পূর্বের শ্রেণি</label>

          {isEditMode ? (
            <select
              name="previous_class_id"
              value={student.previous_class_id || student.previousClass || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            >
              <option value="">পূর্বের শ্রেণি</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
          ) : (
            <p className="border p-2 rounded bg-gray-100">
              {getClassName(student.previous_class_id || student.previousClass)}
            </p>
          )}
        </div>

        {/* CURRENT CLASS */}
        <div>
          <label className="text-sm text-gray-500">বর্তমান শ্রেণি</label>

          {isEditMode ? (
            <select
              name="class_id"
              value={student.class_id || student.currentClass || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            >
              <option value="">বর্তমান শ্রেণি</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>
          ) : (
            <p className="border p-2 rounded bg-gray-100">
              {getClassName(student.class_id || student.currentClass)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentInfoProfile;
