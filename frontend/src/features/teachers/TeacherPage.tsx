import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx-js-style";
import TeacherImageUpload from "../../components/teachers-admission/TeacherImageUpload";
import TeacherInfo from "../../components/teachers-admission/TeacherInfo";
import TeacherParentInfo from "../../components/teachers-admission/TeacherParentInfo";
import AddressInfo from "../../components/teachers-admission/AddressInfo";
import SubmitButton from "../../components/teachers-admission/SubmitButton";
import BulkTeacherUploadModal, {
  ExcelTeacherRow,
} from "../../components/teachers-admission/BulkTeacherUploadModal";
import api from "../../services/api";

export interface TeacherFormData {
  name_bn: string;
  name_ar: string;
  nid: string;
  gender: number | null;
  dob: string;
  age: number | null;
  phone: string;
  email: string;
  designation: string;
  academic_division: string;
  qualification: string;
  experience_year: string;
  experience_month: string;
  joining_date: string;
  salary: string;
  father_name: string;
  father_name_ar: string;
  mother_name: string;
  father_nid: string;
  mother_nid: string;
  father_occupation: string;
  mother_occupation: string;
  parent_phone: string;
  division: string;
  district: string;
  thana: string;
  village: string;
  image: string;
}

export type TeacherFormErrors = Partial<Record<keyof TeacherFormData, string>>;

type DivisionItem = {
  division_id: number;
  division_name_bn: string;
};

const initialState: TeacherFormData = {
  name_bn: "",
  name_ar: "",
  nid: "",
  gender: null,
  dob: "",
  age: null,
  phone: "",
  email: "",
  designation: "",
  academic_division: "",
  qualification: "",
  experience_year: "",
  experience_month: "",
  joining_date: "",
  salary: "",
  father_name: "",
  father_name_ar: "",
  mother_name: "",
  father_nid: "",
  mother_nid: "",
  father_occupation: "",
  mother_occupation: "",
  parent_phone: "",
  division: "",
  district: "",
  thana: "",
  village: "",
  image: "",
};

const requiredColumns = ["name_bn", "academic_division"];

const cleanPhone = (phone: string | number) => String(phone || "").replace(/[^0-9]/g, "");

const toGenderNumber = (value: any) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return num === 1 || num === 2 ? num : null;
};

const calculateAge = (dob?: string) => {
  if (!dob) return null;

  const birth = new Date(dob + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const TeacherPage: React.FC = () => {
  const [formData, setFormData] = useState<TeacherFormData>(initialState);
  const [errors, setErrors] = useState<TeacherFormErrors>({});
  const [excelTeachers, setExcelTeachers] = useState<ExcelTeacherRow[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);

  const extractData = (res: any) => res?.data?.data || res?.data?.result || res?.data || [];

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await api.get("/madrasa-divisions");
        const data = extractData(res);
        setDivisions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Division load error:", err);
        setDivisions([]);
      }
    };

    fetchDivisions();
  }, []);

  const validateForm = () => {
    const newErrors: TeacherFormErrors = {};

    if (!formData.name_bn.trim()) newErrors.name_bn = "শিক্ষকের নাম দিন";
    if (!formData.academic_division) newErrors.academic_division = "একাডেমিক বিভাগ নির্বাচন করুন";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateExcelTeachers = () => {
    if (!excelTeachers.length) return "Excel file upload করুন";

    for (let i = 0; i < excelTeachers.length; i++) {
      const teacher = excelTeachers[i];

      if (!teacher.name_bn && !teacher.name) {
        return `Row ${i + 2}: শিক্ষকের নাম নেই`;
      }

      if (!teacher.academic_division) {
        return `Row ${i + 2}: academic_division নেই`;
      }
    }

    return null;
  };

  const makePayload = (data: TeacherFormData) => ({
    name_bn: data.name_bn,
    name_ar: data.name_ar || null,
    nid: data.nid || null,
    gender: toGenderNumber(data.gender),
    dob: data.dob || null,
    age: data.age ?? calculateAge(data.dob),
    phone: cleanPhone(data.phone) || null,
    email: data.email || null,
    designation: data.designation || null,
    academic_division: Number(data.academic_division),
    division_id: Number(data.academic_division),
    qualification: data.qualification || null,
    experience_year: Number(data.experience_year || 0),
    experience_month: Number(data.experience_month || 0),
    joining_date: data.joining_date || null,
    salary: data.salary ? Number(data.salary) : null,
    father_name: data.father_name || null,
    father_name_ar: data.father_name_ar || null,
    father_nid: data.father_nid || null,
    father_occupation: data.father_occupation || null,
    mother_name: data.mother_name || null,
    mother_nid: data.mother_nid || null,
    mother_occupation: data.mother_occupation || null,
    parent_phone: cleanPhone(data.parent_phone),
    division: data.division || null,
    district: data.district || null,
    thana: data.thana || null,
    village: data.village || null,
    image: data.image || null,
  });

  const makeExcelPayload = () =>
    excelTeachers.map((teacher) => ({
      name_bn: teacher.name_bn || teacher.name,
      name_ar: teacher.name_ar || null,
      nid: teacher.nid || null,
      gender: toGenderNumber(teacher.gender),
      dob: teacher.dob || null,
      age: teacher.age ? Number(teacher.age) : calculateAge(teacher.dob),
      phone: cleanPhone(teacher.phone || "") || null,
      email: teacher.email || null,
      designation: teacher.designation || null,
      academic_division: Number(teacher.academic_division),
      division_id: Number(teacher.academic_division),
      qualification: teacher.qualification || null,
      experience_year: Number(teacher.experience_year || 0),
      experience_month: Number(teacher.experience_month || 0),
      joining_date: teacher.joining_date || null,
      salary: teacher.salary ? Number(teacher.salary) : null,
      father_name: teacher.father_name || null,
      father_name_ar: teacher.father_name_ar || null,
      father_nid: teacher.father_nid || null,
      father_occupation: teacher.father_occupation || null,
      mother_name: teacher.mother_name || null,
      mother_nid: teacher.mother_nid || null,
      mother_occupation: teacher.mother_occupation || null,
      parent_phone: cleanPhone(teacher.parent_phone || ""),
      division: teacher.division || null,
      district: teacher.district || null,
      thana: teacher.thana || null,
      village: teacher.village || null,
      image: teacher.image || null,
    }));

  const downloadTemplate = () => {
    const columns = [
      { key: "name_bn", required: true },
      { key: "name_ar", required: false },
      { key: "nid", required: false },
      { key: "gender", required: false },
      { key: "dob", required: false },
      { key: "phone", required: false },
      { key: "email", required: false },
      { key: "designation", required: false },
      { key: "academic_division", required: true },
      { key: "qualification", required: false },
      { key: "experience_year", required: false },
      { key: "experience_month", required: false },
      { key: "joining_date", required: false },
      { key: "salary", required: false },
      { key: "father_name", required: false },
      { key: "father_name_ar", required: false },
      { key: "father_nid", required: false },
      { key: "father_occupation", required: false },
      { key: "mother_name", required: false },
      { key: "mother_nid", required: false },
      { key: "mother_occupation", required: false },
      { key: "parent_phone", required: false },
      { key: "division", required: false },
      { key: "district", required: false },
      { key: "thana", required: false },
      { key: "village", required: false },
      { key: "image", required: false },
    ];

    const headerRow = columns.map((col) => (col.required ? `${col.key} *` : col.key));

    const sampleRow = [
      "মোঃ আব্দুল করিম",
      "عبد الكريم",
      "1234567890",
      "1",
      "1990-01-20",
      "01700000000",
      "teacher@example.com",
      "সহকারী শিক্ষক",
      divisions[0]?.division_id || "1",
      "দাওরা হাদিস",
      "5",
      "6",
      "2024-01-01",
      "25000",
      "মোঃ রহিম",
      "رحيم",
      "",
      "Business",
      "মোছাঃ আমিনা",
      "",
      "Housewife",
      "01800000000",
      "Dhaka",
      "Dhaka",
      "Mirpur",
      "Kazipara",
      "",
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      ["Required fields are marked with red color and * symbol"],
      [],
      headerRow,
      sampleRow,
    ]);

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
    ws["!cols"] = columns.map(() => ({ wch: 24 }));

    if (ws["A1"]) {
      ws["A1"].s = {
        font: { bold: true, color: { rgb: "92400E" }, sz: 13 },
        fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }

    columns.forEach((col, index) => {
      const cell = XLSX.utils.encode_cell({ r: 2, c: index });
      if (!ws[cell]) return;

      ws[cell].s = {
        font: {
          bold: true,
          color: { rgb: col.required ? "FFFFFF" : "111827" },
        },
        fill: {
          patternType: "solid",
          fgColor: { rgb: col.required ? "DC2626" : "E5E7EB" },
        },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } },
        },
      };
    });

    const guideRows = [
      ["Gender Guide"],
      ["ID", "Name"],
      [1, "পুরুষ"],
      [2, "মহিলা"],
      [],
      ["Academic Division Guide"],
      ["ID", "Academic Division Name"],
      ...divisions.map((d) => [d.division_id, d.division_name_bn]),
    ];

    const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
    guideWs["!cols"] = [{ wch: 15 }, { wch: 35 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teacher Template");
    XLSX.utils.book_append_sheet(wb, guideWs, "Guide");
    XLSX.writeFile(wb, "teacher-template.xlsx");
  };

  const handleBulkModalClose = () => {
    setBulkModalOpen(false);
    setExcelTeachers([]);
  };

  const handleExcelSubmit = async () => {
    const error = validateExcelTeachers();
    if (error) return alert(error);

    try {
      setLoading(true);
      const res = await api.post("/teachers/bulk", { teachers: makeExcelPayload() });
      alert(
        `Bulk Teacher Upload Successful ✅\nনতুন: ${res.data?.inserted || 0} | আপডেট: ${res.data?.updated || 0}`,
      );
      setExcelTeachers([]);
      setBulkModalOpen(false);
    } catch (error: any) {
      alert(error?.response?.data?.message || "Bulk Teacher Upload Failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      await api.post("/teachers", makePayload(formData));
      alert("Teacher Added Successfully ✅");
      setFormData(initialState);
      setErrors({});
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to add teacher ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="relative mb-6">
        <h1 className="text-3xl font-bold text-center">Teacher Registration</h1>

        <button
          type="button"
          onClick={() => setBulkModalOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Bulk Upload
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <TeacherImageUpload formData={formData} setFormData={setFormData} />

        <TeacherInfo
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
          divisions={divisions}
        />

        <TeacherParentInfo formData={formData} setFormData={setFormData} />

        <AddressInfo formData={formData} setFormData={setFormData} />

        <SubmitButton loading={loading} text="Teacher Save" />
      </form>

      <BulkTeacherUploadModal
        open={bulkModalOpen}
        loading={loading}
        excelTeachers={excelTeachers}
        requiredColumns={requiredColumns}
        onClose={handleBulkModalClose}
        onDataUpload={setExcelTeachers}
        onClear={() => setExcelTeachers([])}
        onSubmit={handleExcelSubmit}
        onDownloadTemplate={downloadTemplate}
        divisions={divisions}
      />
    </div>
  );
};

export default TeacherPage;
