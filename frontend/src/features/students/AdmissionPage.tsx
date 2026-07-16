import { useEffect, useState } from "react";
import * as XLSX from "xlsx-js-style";
import StudentInfo from "../../components/admission/StudentInfo";
import ParentInfo from "../../components/admission/ParentInfo";
import AddressInfo from "../../components/admission/AddressInfo";
import ImageUpload from "../../components/admission/ImageUpload";
import SubmitButton from "../../components/admission/SubmitButton";
import BulkAdmissionModal, {
  ExcelAdmissionRow,
} from "../../components/admission/BulkAdmissionModal";
import api from "../../services/api";

export interface AdmissionFormData {
  name: string;
  arabicName: string;
  nid: string;
  gender: number | null;
  dob: string;
  age: number | null;
  academicYear: string;
  academicDivision: string;
  previousClass: string;
  currentClass: string;
  fatherName: string;
  fatherArabicName: string;
  fatherNid: string;
  fatherOccupation: string;
  motherName: string;
  motherNid: string;
  motherOccupation: string;
  parentPhone: string;
  division: string;
  district: string;
  thana: string;
  village: string;
  image: string;
}

export type AdmissionFormErrors = Partial<Record<keyof AdmissionFormData, string>>;

type DivisionItem = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
  division_id?: number;
};

const initialState: AdmissionFormData = {
  name: "",
  arabicName: "",
  nid: "",
  gender: null,
  dob: "",
  age: null,
  academicYear: String(new Date().getFullYear()),
  academicDivision: "",
  previousClass: "",
  currentClass: "",
  fatherName: "",
  fatherArabicName: "",
  fatherNid: "",
  fatherOccupation: "",
  motherName: "",
  motherNid: "",
  motherOccupation: "",
  parentPhone: "",
  division: "",
  district: "",
  thana: "",
  village: "",
  image: "",
};

const cleanPhone = (phone: string | number) => String(phone || "").replace(/[^0-9]/g, "");

const toGenderNumber = (value: any) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return num === 1 || num === 2 ? num : null;
};

const requiredColumns = ["name_bn", "academic_division", "current_class", "academic_year"];

const AdmissionPage = () => {
  const [formData, setFormData] = useState<AdmissionFormData>(initialState);
  const [errors, setErrors] = useState<AdmissionFormErrors>({});
  const [excelStudents, setExcelStudents] = useState<ExcelAdmissionRow[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const extractData = (res: any) => res?.data?.data || res?.data?.result || res?.data || [];

  useEffect(() => {
    const fetchHelperData = async () => {
      try {
        const divRes = await api.get("/madrasa-divisions");
        const divData = extractData(divRes);
        const safeDivisions: DivisionItem[] = Array.isArray(divData) ? divData : [];

        setDivisions(safeDivisions);

        const classResults = await Promise.all(
          safeDivisions.map(async (division) => {
            try {
              const res = await api.get(`/madrasa-classes?division_id=${division.division_id}`);
              const data = extractData(res);
              const list = Array.isArray(data) ? data : [];

              return list.map((item: ClassItem) => ({
                ...item,
                division_id: division.division_id,
              }));
            } catch {
              return [];
            }
          }),
        );

        setClasses(classResults.flat());
      } catch (err) {
        console.error("Helper data load error:", err);
        setDivisions([]);
        setClasses([]);
      }
    };

    fetchHelperData();
  }, []);

  const calculateAge = (dob?: string) => {
    if (!dob) return null;

    const birth = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    return age;
  };

  const handleBulkModalClose = () => {
    setBulkModalOpen(false);
    setExcelStudents([]);
  };

  const validateForm = () => {
    const newErrors: AdmissionFormErrors = {};

    if (!formData.name.trim()) newErrors.name = "ছাত্রের নাম দিন";
    if (!formData.academicYear) newErrors.academicYear = "সিক্ষাবর্ষ নির্বাচন করুন";
    if (!formData.academicDivision) newErrors.academicDivision = "বিভাগ নির্বাচন করুন";
    if (!formData.currentClass) newErrors.currentClass = "বর্তমান শ্রেণি নির্বাচন করুন";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateExcelStudents = () => {
    if (!excelStudents.length) return "Excel file upload করুন";

    for (let i = 0; i < excelStudents.length; i++) {
      const student = excelStudents[i];

      if (!student.name_bn && !student.name) {
        return `Row ${i + 2}: ছাত্রের নাম নেই`;
      }

      if (!student.academic_division) {
        return `Row ${i + 2}: academic_division নেই`;
      }

      if (!student.current_class && !student.class_id) {
        return `Row ${i + 2}: current_class/class_id নেই`;
      }
    }

    return null;
  };

  const makeExcelPayload = () =>
    excelStudents.map((student) => ({
      name_bn: student.name_bn || student.name,
      gender: toGenderNumber(student.gender),
      dob: student.dob || null,
      class_id: Number(student.class_id || student.current_class),
      academic_year: String(student.academic_year || new Date().getFullYear()),
      previous_class_id: Number(student.previous_class) || null,
      division_id: Number(student.academic_division),
      guardian_phone: cleanPhone(student.guardian_phone || student.parent_phone || ""),
      arabic_name: student.arabic_name || null,
      nid: student.nid || null,
      age: calculateAge(student.dob),
      father_name: student.father_name || null,
      father_arabic_name: student.father_arabic_name || null,
      father_nid: student.father_nid || null,
      father_occupation: student.father_occupation || null,
      mother_name: student.mother_name || null,
      mother_nid: student.mother_nid || null,
      mother_occupation: student.mother_occupation || null,
      division: student.division || null,
      district: student.district || null,
      thana: student.thana || null,
      village: student.village || null,
      image: student.image || null,
    }));

  const downloadTemplate = () => {
    const columns = [
      { key: "name_bn", required: true },
      { key: "arabic_name", required: false },
      { key: "nid", required: false },
      { key: "gender", required: false },
      { key: "dob", required: false },
      { key: "academic_year", required: true },
      { key: "academic_division", required: true },
      { key: "previous_class", required: false },
      { key: "current_class", required: true },
      { key: "guardian_phone", required: false },
      { key: "father_name", required: false },
      { key: "father_arabic_name", required: false },
      { key: "father_nid", required: false },
      { key: "father_occupation", required: false },
      { key: "mother_name", required: false },
      { key: "mother_nid", required: false },
      { key: "mother_occupation", required: false },
      { key: "division", required: false },
      { key: "district", required: false },
      { key: "thana", required: false },
      { key: "village", required: false },
      { key: "image", required: false },
    ];

    const headerRow = columns.map((col) => (col.required ? `${col.key} *` : col.key));

    const sampleRow = [
      "মোঃ আব্দুল্লাহ",
      "عبدالله",
      "1234567890",
      "1",
      "2015-01-20",
      String(new Date().getFullYear()),
      divisions[0]?.division_id || "1",
      "",
      classes[0]?.class_id || "1",
      "01700000000",
      "মোঃ করিম",
      "كريم",
      "",
      "Business",
      "মোছাঃ আমিনা",
      "",
      "Housewife",
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
      [1, "ছেলে"],
      [2, "মেয়ে"],
      [],
      ["Division Guide"],
      ["ID", "Division Name"],
      ...divisions.map((d) => [d.division_id, d.division_name_bn]),
      [],
      ["Class Guide"],
      ["ID", "Class Name", "Division ID"],
      ...classes.map((c) => [c.class_id, c.class_name_bn, c.division_id || ""]),
    ];

    const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
    guideWs["!cols"] = [{ wch: 15 }, { wch: 35 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admission Template");
    XLSX.utils.book_append_sheet(wb, guideWs, "Guide");
    XLSX.writeFile(wb, "admission-template.xlsx");
  };

  const handleExcelSubmit = async () => {
    const error = validateExcelStudents();
    if (error) return alert(error);

    try {
      setLoading(true);

      const res = await api.post("/students/admission/bulk", {
        students: makeExcelPayload(),
      });

      alert(
        `Bulk Admission Successful ✅\nনতুন: ${res.data?.inserted || 0} | আপডেট: ${res.data?.updated || 0}`,
      );
      setExcelStudents([]);
      setBulkModalOpen(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Bulk Admission Failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validateForm();
    if (!isValid) return;

    const payload = {
      name_bn: formData.name,
      gender: toGenderNumber(formData.gender),
      dob: formData.dob || null,
      class_id: Number(formData.currentClass),
      academic_year: formData.academicYear,
      previous_class_id: Number(formData.previousClass) || null,
      division_id: Number(formData.academicDivision),
      guardian_phone: cleanPhone(formData.parentPhone),
      arabic_name: formData.arabicName || null,
      nid: formData.nid || null,
      age: calculateAge(formData.dob),
      father_name: formData.fatherName || null,
      father_arabic_name: formData.fatherArabicName || null,
      father_nid: formData.fatherNid || null,
      father_occupation: formData.fatherOccupation || null,
      mother_name: formData.motherName || null,
      mother_nid: formData.motherNid || null,
      mother_occupation: formData.motherOccupation || null,
      division: formData.division || null,
      district: formData.district || null,
      thana: formData.thana || null,
      village: formData.village || null,
      image: formData.image || null,
    };

    try {
      setLoading(true);

      await api.post("/students/admission", payload);

      alert("Admission Successful ✅");
      setFormData(initialState);
      setErrors({});
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="relative mb-6">
        <h1 className="text-3xl font-bold text-center">Student Registration</h1>

        <button
          type="button"
          onClick={() => setBulkModalOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Bulk Upload
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ImageUpload formData={formData} setFormData={setFormData} />

        <StudentInfo
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
        />

        <ParentInfo
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
        />

        <AddressInfo formData={formData} setFormData={setFormData} />
        <SubmitButton loading={loading} />
      </form>

      <BulkAdmissionModal
        open={bulkModalOpen}
        loading={loading}
        excelStudents={excelStudents}
        requiredColumns={requiredColumns}
        divisions={divisions}
        classes={classes}
        onClose={handleBulkModalClose}
        onDataUpload={setExcelStudents}
        onClear={() => setExcelStudents([])}
        onSubmit={handleExcelSubmit}
        onDownloadTemplate={downloadTemplate}
      />
    </div>
  );
};

export default AdmissionPage;
