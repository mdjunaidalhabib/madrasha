import { useEffect, useRef, useState } from "react";
import StudentInfo from "../../components/admission/StudentInfo";
import ParentInfo from "../../components/admission/ParentInfo";
import OtherInfo from "../../components/admission/OtherInfo";
import AlternateGuardianInfo from "../../components/admission/AlternateGuardianInfo";
import AddressInfo from "../../components/admission/AddressInfo";
import ImageUpload from "../../components/admission/ImageUpload";
import SubmitButton from "../../components/admission/SubmitButton";
import PreviousStudentBanner from "../../components/admission/PreviousStudentBanner";
import BulkAdmissionModal, {
  BulkAdmissionResultData,
  ExcelAdmissionRow,
} from "../../components/admission/BulkAdmissionModal";
import api, { cachedGet } from "../../services/api";
import { invoiceApi, type PaymentMethod } from "../../services/phase2Api";
import { logger } from "../../utils/logger";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";

export interface AdmissionFormData {
  name: string;
  arabicName: string;
  nid: string;
  gender: number | null;
  dob: string;
  age: number | null;
  bloodGroup: string;
  residencyType: number | null;
  isOrphan: boolean;
  roll: string;
  admissionDate: string;
  academicYear: string;
  academicDivision: string;
  previousClass: string;
  previousInstitution: string;
  previousResult: string;
  currentClass: string;
  fatherName: string;
  fatherArabicName: string;
  fatherNid: string;
  fatherOccupation: string;
  motherName: string;
  motherNid: string;
  motherOccupation: string;
  parentPhone: string;
  parentPhone2: string;
  hasAltGuardian: boolean;
  altGuardianName: string;
  altGuardianRelation: string;
  altGuardianAddress: string;
  altGuardianPhone: string;
  division: string;
  district: string;
  thana: string;
  village: string;
  image: string;
}

export type AdmissionFormErrors = Partial<Record<keyof AdmissionFormData, string>>;

type AdmissionInvoice = {
  id: number;
  title: string;
  amount: number;
  paidAmount: number;
  waivedAmount: number;
  status: string;
};

// Shown right after a successful submit — the admission is now PENDING and
// billed for the class's default fees; office staff can collect payment here
// in the same flow instead of navigating to the Fee Collection page.
type FeeStep = {
  studentLabel: string;
  invoices: AdmissionInvoice[];
};

interface PreviousStudentData {
  id: number;
  name_bn: string;
  arabic_name: string | null;
  nid: string | null;
  gender: number | null;
  dob: string | null;
  age: number | null;
  blood_group: string | null;
  residency_type: number | null;
  is_orphan: number | null;
  roll: number | null;
  division_id: number | null;
  class_id: number | null;
  academic_year: string;
  previous_class_id: number | null;
  previous_institution: string | null;
  previous_result: string | null;
  current_class: string | null;
  father_name: string | null;
  father_arabic_name: string | null;
  father_nid: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_nid: string | null;
  mother_occupation: string | null;
  guardian_phone: string | null;
  guardian_phone_2: string | null;
  alt_guardian_name: string | null;
  alt_guardian_relation: string | null;
  alt_guardian_address: string | null;
  alt_guardian_phone: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  village: string | null;
  image: string | null;
}

type DivisionItem = {
  division_id: number;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  class_name_bn: string;
  division_id?: number;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const initialState: AdmissionFormData = {
  name: "",
  arabicName: "",
  nid: "",
  gender: null,
  dob: "",
  age: null,
  bloodGroup: "",
  residencyType: null,
  isOrphan: false,
  roll: "",
  admissionDate: todayIso(),
  academicYear: String(new Date().getFullYear()),
  academicDivision: "",
  previousClass: "",
  previousInstitution: "",
  previousResult: "",
  currentClass: "",
  fatherName: "",
  fatherArabicName: "",
  fatherNid: "",
  fatherOccupation: "",
  motherName: "",
  motherNid: "",
  motherOccupation: "",
  parentPhone: "",
  parentPhone2: "",
  hasAltGuardian: false,
  altGuardianName: "",
  altGuardianRelation: "",
  altGuardianAddress: "",
  altGuardianPhone: "",
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
  const [bulkResult, setBulkResult] = useState<BulkAdmissionResultData | null>(null);
  const [loading, setLoading] = useState(false);

  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [previousStudent, setPreviousStudent] = useState<PreviousStudentData | null>(null);
  const [nidLookupLoading, setNidLookupLoading] = useState(false);
  const lookupAbortRef = useRef<AbortController | null>(null);

  const [feeStep, setFeeStep] = useState<FeeStep | null>(null);
  const [feePayAmounts, setFeePayAmounts] = useState<Record<number, string>>({});
  const [feePayMethod, setFeePayMethod] = useState<PaymentMethod>("CASH");
  const [feePaying, setFeePaying] = useState(false);

  const extractData = (res: any) => res?.data?.data || res?.data?.result || res?.data || [];

  // Look up previous admission data by NID as soon as office staff types it
  // in, so returning students can be detected before submit and re-admitted
  // into the new session instead of being entered as a duplicate.
  useEffect(() => {
    const nid = formData.nid.trim();

    lookupAbortRef.current?.abort();

    if (nid.length < 4) {
      setPreviousStudent(null);
      setNidLookupLoading(false);
      return;
    }

    const controller = new AbortController();
    lookupAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        setNidLookupLoading(true);

        const res = await cachedGet(`/students/lookup?nid=${encodeURIComponent(nid)}`, {
          signal: controller.signal,
        });

        const found = res?.data?.found;
        const data = res?.data?.data as PreviousStudentData | null;

        if (found && data) {
          setPreviousStudent(data);

          setFormData((prev) => ({
            ...prev,
            name: data.name_bn || prev.name,
            arabicName: data.arabic_name || prev.arabicName,
            gender: data.gender ?? prev.gender,
            dob: data.dob ? String(data.dob).slice(0, 10) : prev.dob,
            age: data.age ?? prev.age,
            academicDivision: data.division_id ? String(data.division_id) : prev.academicDivision,
            previousClass: data.class_id ? String(data.class_id) : prev.previousClass,
            bloodGroup: data.blood_group || prev.bloodGroup,
            residencyType: data.residency_type ?? prev.residencyType,
            isOrphan: data.is_orphan === 1 ? true : prev.isOrphan,
            previousInstitution: data.previous_institution || prev.previousInstitution,
            previousResult: data.previous_result || prev.previousResult,
            fatherName: data.father_name || prev.fatherName,
            fatherArabicName: data.father_arabic_name || prev.fatherArabicName,
            fatherNid: data.father_nid || prev.fatherNid,
            fatherOccupation: data.father_occupation || prev.fatherOccupation,
            motherName: data.mother_name || prev.motherName,
            motherNid: data.mother_nid || prev.motherNid,
            motherOccupation: data.mother_occupation || prev.motherOccupation,
            parentPhone: data.guardian_phone || prev.parentPhone,
            parentPhone2: data.guardian_phone_2 || prev.parentPhone2,
            hasAltGuardian: Boolean(data.alt_guardian_name) || prev.hasAltGuardian,
            altGuardianName: data.alt_guardian_name || prev.altGuardianName,
            altGuardianRelation: data.alt_guardian_relation || prev.altGuardianRelation,
            altGuardianAddress: data.alt_guardian_address || prev.altGuardianAddress,
            altGuardianPhone: data.alt_guardian_phone || prev.altGuardianPhone,
            division: data.division || prev.division,
            district: data.district || prev.district,
            thana: data.thana || prev.thana,
            village: data.village || prev.village,
            image: data.image || prev.image,
          }));
        } else {
          setPreviousStudent(null);
        }
      } catch (err: any) {
        if (err?.name !== "CanceledError") {
          logger.error("NID lookup error:", err);
        }
      } finally {
        setNidLookupLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nid]);

  // Show the next roll as a preview, but let the backend assign the final
  // value transaction-safely at submit time. This field is display-only;
  // users cannot submit or override a roll number manually.
  useEffect(() => {
    const classId = formData.currentClass;
    const year = formData.academicYear;

    if (!classId || !year) {
      setFormData((prev) => ({ ...prev, roll: "" }));
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await cachedGet("/students/next-roll", {
          params: { class_id: classId, academic_year: year },
        });
        const suggested = res?.data?.data;

        if (!cancelled && suggested) {
          setFormData((prev) => ({ ...prev, roll: String(suggested) }));
        }
      } catch (err) {
        logger.error("Next roll suggestion error:", err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.currentClass, formData.academicYear]);

  const handleDismissPreviousStudent = () => {
    setPreviousStudent(null);
    setFormData((prev) => ({ ...prev, nid: "" }));
  };

  useEffect(() => {
    const fetchHelperData = async () => {
      try {
        const divRes = await cachedGet("/madrasa-divisions");
        const divData = extractData(divRes);
        const safeDivisions: DivisionItem[] = Array.isArray(divData) ? divData : [];

        setDivisions(safeDivisions);

        const classResults = await Promise.all(
          safeDivisions.map(async (division) => {
            try {
              const res = await cachedGet(`/madrasa-classes?division_id=${division.division_id}`);
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
        logger.error("Helper data load error:", err);
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
    setBulkResult(null);
  };

  const handleBulkClear = () => {
    setExcelStudents([]);
    setBulkResult(null);
  };

  const validateForm = () => {
    const newErrors: AdmissionFormErrors = {};

    if (!formData.name.trim()) newErrors.name = "ছাত্রের নাম দিন";
    if (!formData.academicYear) newErrors.academicYear = "শিক্ষাবর্ষ নির্বাচন করুন";
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

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx-js-style");
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
    if (error) return useToastStore.getState().show(error, "error");

    try {
      setLoading(true);

      const res = await api.post("/students/admission/bulk", {
        students: makeExcelPayload(),
      });

      setBulkResult({
        inserted: res.data?.inserted || 0,
        updated: res.data?.updated || 0,
        preview: res.data?.preview || [],
      });
      setExcelStudents([]);
    } catch (err: any) {
      useToastStore
        .getState()
        .show(err?.response?.data?.message || "Bulk Admission Failed ❌", "error");
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
      blood_group: formData.bloodGroup || null,
      residency_type: formData.residencyType,
      is_orphan: formData.isOrphan ? 1 : 0,
      class_id: Number(formData.currentClass),
      academic_year: formData.academicYear,
      admission_date: formData.admissionDate || null,
      previous_class_id: Number(formData.previousClass) || null,
      previous_institution: formData.previousInstitution || null,
      previous_result: formData.previousResult || null,
      division_id: Number(formData.academicDivision),
      guardian_phone: cleanPhone(formData.parentPhone),
      guardian_phone_2: formData.parentPhone2 ? cleanPhone(formData.parentPhone2) : null,
      alt_guardian_name: formData.hasAltGuardian ? formData.altGuardianName || null : null,
      alt_guardian_relation: formData.hasAltGuardian ? formData.altGuardianRelation || null : null,
      alt_guardian_address: formData.hasAltGuardian ? formData.altGuardianAddress || null : null,
      alt_guardian_phone: formData.hasAltGuardian
        ? cleanPhone(formData.altGuardianPhone) || null
        : null,
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

      const res = await api.post("/students/admission", payload);

      if (res.data?.action === "re_admitted") {
        useToastStore
          .getState()
          .show(
            `পুনঃভর্তি সফল হয়েছে ✅ (পূর্বের সেশন: ${res.data?.previousAcademicYear || "-"} → নতুন সেশন: ${formData.academicYear}) | রেজিস্ট্রেশন: ${res.data?.registrationNo || "-"} | রোল: ${res.data?.roll || "-"} — মুহতামিমের অনুমোদনের অপেক্ষায়`,
            "success",
          );
      } else {
        useToastStore
          .getState()
          .show(
            `Admission Successful ✅ রেজিস্ট্রেশন: ${res.data?.registrationNo || "-"} | রোল: ${res.data?.roll || "-"} — মুহতামিমের অনুমোদনের অপেক্ষায়`,
            "success",
          );
      }

      // Every admission now lands PENDING and is billed for the class's
      // default fees right away (see admitStudent on the backend) - offer to
      // collect that payment inline instead of resetting the form straight
      // away. Skips straight to reset when there's nothing to collect (e.g.
      // the class has no fee structures configured).
      const invoices: AdmissionInvoice[] = res.data?.invoices || [];
      if (invoices.length > 0) {
        setFeeStep({ studentLabel: formData.name, invoices });
        const amounts: Record<number, string> = {};
        invoices.forEach((inv) => {
          const remaining = inv.amount - inv.paidAmount - inv.waivedAmount;
          amounts[inv.id] = remaining > 0 ? String(remaining) : "0";
        });
        setFeePayAmounts(amounts);
        setFeePayMethod("CASH");
      } else {
        setFormData(initialState);
        setErrors({});
        setPreviousStudent(null);
      }
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || "Failed ❌", "error");
    } finally {
      setLoading(false);
    }
  };

  const closeFeeStep = () => {
    setFeeStep(null);
    setFormData(initialState);
    setErrors({});
    setPreviousStudent(null);
  };

  const handleRecordFee = async () => {
    if (!feeStep) return;
    const lines = feeStep.invoices
      .map((inv) => ({ id: inv.id, amount: Number(feePayAmounts[inv.id] || 0) }))
      .filter((line) => line.amount > 0);

    if (lines.length === 0) {
      useToastStore.getState().show("অন্তত একটি ফি-র জন্য পরিমাণ দিন", "error");
      return;
    }

    try {
      setFeePaying(true);
      let success = 0;
      let failed = 0;
      for (const line of lines) {
        try {
          await invoiceApi.pay(line.id, { amount: line.amount, method: feePayMethod });
          success += 1;
        } catch (err) {
          failed += 1;
          logger.error("ADMISSION FEE PAY ERROR:", err);
        }
      }
      useToastStore
        .getState()
        .show(
          failed === 0
            ? "ফি পরিশোধ রেকর্ড করা হয়েছে"
            : `${success}টি সফল, ${failed}টি ব্যর্থ হয়েছে — বাকিটা পরে Fee Collection পেজ থেকে নেওয়া যাবে`,
          failed === 0 ? "success" : "error",
        );
    } finally {
      setFeePaying(false);
      closeFeeStep();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center relative gap-2 sm:gap-3 mb-6">
        <button
          type="button"
          onClick={() => setBulkModalOpen(true)}
          className="self-end sm:self-auto sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap"
        >
          Bulk Upload
        </button>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center break-words">
          Student Registration
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {(nidLookupLoading || previousStudent) && (
          <PreviousStudentBanner
            loading={nidLookupLoading}
            studentName={previousStudent?.name_bn || ""}
            previousAcademicYear={previousStudent?.academic_year || ""}
            previousClassName={previousStudent?.current_class || null}
            onDismiss={handleDismissPreviousStudent}
          />
        )}

        <ImageUpload formData={formData} setFormData={setFormData} />

        <StudentInfo
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
          isReturning={Boolean(previousStudent)}
        />

        <ParentInfo
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
        />

        <AlternateGuardianInfo formData={formData} setFormData={setFormData} />

        <OtherInfo formData={formData} setFormData={setFormData} />

        <AddressInfo formData={formData} setFormData={setFormData} />
        <SubmitButton loading={loading} isReAdmission={Boolean(previousStudent)} />
      </form>

      <BulkAdmissionModal
        open={bulkModalOpen}
        loading={loading}
        excelStudents={excelStudents}
        requiredColumns={requiredColumns}
        divisions={divisions}
        classes={classes}
        result={bulkResult}
        onClose={handleBulkModalClose}
        onDataUpload={setExcelStudents}
        onClear={handleBulkClear}
        onSubmit={handleExcelSubmit}
        onDownloadTemplate={downloadTemplate}
      />

      {/* Right after a successful submit — the admission is PENDING and
          already billed for the class's default fees; office can collect
          that payment here in the same flow, or skip and do it later from
          Fee Collection. */}
      <Modal
        open={!!feeStep}
        title={`ভর্তি ফি — ${feeStep?.studentLabel || ""}`}
        onClose={closeFeeStep}
        maxWidthClassName="max-w-lg"
      >
        {feeStep && (
          <div className="flex flex-col gap-4">
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              ভর্তি আবেদনটি মুহতামিমের অনুমোদনের অপেক্ষায় আছে। ফি এখন নিতে না চাইলে "পরে নেব" চেপে
              এগিয়ে যান — পরে Fee Collection পেজ থেকেও নেওয়া যাবে।
            </p>

            <div className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-2.5 dark:bg-slate-800">
              {feeStep.invoices.map((inv) => {
                const remaining = inv.amount - inv.paidAmount - inv.waivedAmount;
                return (
                  <div key={inv.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-slate-300">
                      {inv.title} <span className="text-gray-400 dark:text-slate-500">(বাকি ৳{remaining})</span>
                    </span>
                    <input
                      type="number"
                      value={feePayAmounts[inv.id] ?? ""}
                      disabled={remaining <= 0}
                      onChange={(e) =>
                        setFeePayAmounts((prev) => ({ ...prev, [inv.id]: e.target.value }))
                      }
                      className="h-8 w-24 shrink-0 rounded-md border border-gray-300 px-2 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60"
                    />
                  </div>
                );
              })}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">পদ্ধতি</label>
              <select
                value={feePayMethod}
                onChange={(e) => setFeePayMethod(e.target.value as PaymentMethod)}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(["CASH", "BKASH", "NAGAD", "BANK", "ONLINE"] as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeFeeStep}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            পরে নেব
          </button>
          <button
            type="button"
            disabled={feePaying}
            onClick={handleRecordFee}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {feePaying ? "সংরক্ষণ হচ্ছে..." : "পেমেন্ট রেকর্ড করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AdmissionPage;
