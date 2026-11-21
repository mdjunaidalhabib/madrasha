import { useEffect, useRef, useState } from "react";
import { useUnsavedChangesGuard } from "@madrasha/shared-ui/src/navigation/unsavedChanges";
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
import { refreshSidebarCounts } from "../../services/sidebarApi";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { useText, getText } from "@madrasha/shared-ui/src/i18n";
import { admissionPageText } from "./AdmissionPage.text";
import ProgressOverlay from "@madrasha/shared-ui/src/components/ui/ProgressOverlay";
import { useProgressTask } from "@madrasha/shared-ui/src/components/ui/useProgressTask";
import { academicExcelId, appendAcademicExcelIds } from "../../utils/academicExcelIds";

import type { AdmissionFormData, AdmissionFormErrors } from "@madrasha/shared-ui/src/components/admission/types";
export type { AdmissionFormData, AdmissionFormErrors } from "@madrasha/shared-ui/src/components/admission/types";

interface PreviousStudentData {
  id: number;
  registration_no: number | null;
  name_bn: string;
  arabic_name: string | null;
  name_en: string | null;
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
  father_name_en: string | null;
  father_nid: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_arabic_name: string | null;
  mother_name_en: string | null;
  mother_nid: string | null;
  mother_occupation: string | null;
  guardian_phone: string | null;
  guardian_phone_2: string | null;
  alt_guardian_name: string | null;
  alt_guardian_arabic_name: string | null;
  alt_guardian_name_en: string | null;
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
  local_no?: number | null;
  division_name_bn: string;
};

type ClassItem = {
  class_id: number;
  local_no?: number | null;
  class_name_bn: string;
  division_id?: number;
};

interface AdmissionSuccessInfo {
  isReAdmission: boolean;
  registrationNo: string;
  roll: string;
  previousAcademicYear: string;
  academicYear: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const initialState: AdmissionFormData = {
  name: "",
  arabicName: "",
  nameEn: "",
  nid: "",
  gender: 1,
  dob: "",
  age: null,
  bloodGroup: "",
  residencyType: 1,
  isOrphan: false,
  roll: "",
  admissionDate: todayIso(),
  academicYear: "",
  academicDivision: "",
  previousClass: "",
  previousInstitution: "",
  previousResult: "",
  currentClass: "",
  fatherName: "",
  fatherArabicName: "",
  fatherNameEn: "",
  fatherNid: "",
  fatherOccupation: "",
  motherName: "",
  motherArabicName: "",
  motherNameEn: "",
  motherNid: "",
  motherOccupation: "",
  parentPhone: "",
  parentPhone2: "",
  hasAltGuardian: false,
  altGuardianName: "",
  altGuardianArabicName: "",
  altGuardianNameEn: "",
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
  const t = useText(admissionPageText);
  const progressTask = useProgressTask();
  const [formData, setFormData] = useState<AdmissionFormData>(initialState);
  const [errors, setErrors] = useState<AdmissionFormErrors>({});
  const [excelStudents, setExcelStudents] = useState<ExcelAdmissionRow[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkAdmissionResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<AdmissionSuccessInfo | null>(null);
  // Warn before Back / Refresh / navigation discards a half-filled admission form
  // (not after a successful submit - the form is already saved by then).
  useUnsavedChangesGuard(formData !== initialState && !successInfo);
  const newFormButtonRef = useRef<HTMLButtonElement | null>(null);

  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [previousStudent, setPreviousStudent] = useState<PreviousStudentData | null>(null);
  const [admissionMode, setAdmissionMode] = useState<"new" | "existing">("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PreviousStudentData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const canSearch = searchQuery.trim().length >= 2 || /^[0-9০-৯]+$/.test(searchQuery.trim());
  const [nidLookupLoading, setNidLookupLoading] = useState(false);
  const lookupAbortRef = useRef<AbortController | null>(null);

  const extractData = (res: any) => res?.data?.data || res?.data?.result || res?.data || [];

  const selectPreviousStudent = (data: PreviousStudentData) => {
    lookupAbortRef.current?.abort();
    setNidLookupLoading(false);
    setAdmissionMode("existing");
    setPreviousStudent(data);
    setErrors({});
    setFormData((prev) => ({
      ...initialState,
      academicYear: String(data.division_id || "") === prev.academicDivision ? prev.academicYear : "",
      nid: data.nid || "",
      name: data.name_bn || initialState.name,
      arabicName: data.arabic_name || initialState.arabicName,
      nameEn: data.name_en || initialState.nameEn,
      gender: data.gender ?? initialState.gender,
      dob: data.dob ? String(data.dob).slice(0, 10) : initialState.dob,
      age: data.age ?? initialState.age,
      academicDivision: data.division_id ? String(data.division_id) : initialState.academicDivision,
      previousClass: data.class_id ? String(data.class_id) : initialState.previousClass,
      bloodGroup: data.blood_group || initialState.bloodGroup,
      residencyType: data.residency_type ?? initialState.residencyType,
      isOrphan: data.is_orphan === 1 ? true : initialState.isOrphan,
      previousInstitution: data.previous_institution || initialState.previousInstitution,
      previousResult: data.previous_result || initialState.previousResult,
      fatherName: data.father_name || initialState.fatherName,
      fatherArabicName: data.father_arabic_name || initialState.fatherArabicName,
      fatherNameEn: data.father_name_en || initialState.fatherNameEn,
      fatherNid: data.father_nid || initialState.fatherNid,
      fatherOccupation: data.father_occupation || initialState.fatherOccupation,
      motherName: data.mother_name || initialState.motherName,
      motherArabicName: data.mother_arabic_name || initialState.motherArabicName,
      motherNameEn: data.mother_name_en || initialState.motherNameEn,
      motherNid: data.mother_nid || initialState.motherNid,
      motherOccupation: data.mother_occupation || initialState.motherOccupation,
      parentPhone: data.guardian_phone || initialState.parentPhone,
      parentPhone2: data.guardian_phone_2 || initialState.parentPhone2,
      hasAltGuardian: Boolean(data.alt_guardian_name) || initialState.hasAltGuardian,
      altGuardianName: data.alt_guardian_name || initialState.altGuardianName,
      altGuardianArabicName: data.alt_guardian_arabic_name || initialState.altGuardianArabicName,
      altGuardianNameEn: data.alt_guardian_name_en || initialState.altGuardianNameEn,
      altGuardianRelation: data.alt_guardian_relation || initialState.altGuardianRelation,
      altGuardianAddress: data.alt_guardian_address || initialState.altGuardianAddress,
      altGuardianPhone: data.alt_guardian_phone || initialState.altGuardianPhone,
      division: data.division || initialState.division,
      district: data.district || initialState.district,
      thana: data.thana || initialState.thana,
      village: data.village || initialState.village,
      image: data.image || initialState.image,
    }));
  };

  useEffect(() => {
    if (admissionMode !== "existing" || previousStudent || !canSearch) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(false);
    setSearchResults([]);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/students/admission/search", {
          params: { q: searchQuery.trim() }, signal: controller.signal,
        });
        if (!controller.signal.aborted) setSearchResults(res.data?.data || []);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [admissionMode, searchQuery, previousStudent, canSearch]);

  // Look up previous admission data by NID as soon as office staff types it
  // in, so returning students can be detected before submit and re-admitted
  // into the new session instead of being entered as a duplicate.
  useEffect(() => {
    if (previousStudent || admissionMode === "existing") return;
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

        if (controller.signal.aborted) return;
        if (found && data) {
          selectPreviousStudent(data);
        } else {
          setPreviousStudent(null);
        }
      } catch (err: any) {
        if (err?.name !== "CanceledError") {
          logger.error("NID lookup error:", err);
        }
      } finally {
        if (!controller.signal.aborted) setNidLookupLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nid, admissionMode, previousStudent]);

  // ভর্তির সময় কোনো রোল দেখানো/দেওয়া হয় না - মুহতামিম অনুমোদন করলে তবেই
  // সার্ভার রোল বরাদ্দ করে (backend approveAdmission)।

  const handleStartNewAdmission = () => {
    setFormData(initialState);
    setErrors({});
    setPreviousStudent(null);
    setSuccessInfo(null);
    setAdmissionMode("new");
    setSearchQuery("");
    setSearchResults([]);
  };

  // Auto-focus the "নতুন ভর্তি ফর্ম" button as soon as the success modal
  // opens, so pressing Enter immediately starts a fresh form without
  // requiring a mouse click.
  useEffect(() => {
    if (successInfo) newFormButtonRef.current?.focus();
  }, [successInfo]);

  const changeAdmissionMode = (mode: "new" | "existing") => {
    lookupAbortRef.current?.abort();
    setNidLookupLoading(false);
    setFormData(initialState);
    setErrors({});
    setPreviousStudent(null);
    setAdmissionMode(mode);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(false);
  };

  const handleDismissPreviousStudent = () => changeAdmissionMode("existing");

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

    if (!formData.name.trim()) newErrors.name = t.errName;
    if (!formData.academicYear) newErrors.academicYear = t.errSession;
    if (!formData.academicDivision) newErrors.academicDivision = t.errDivision;
    if (!formData.currentClass) newErrors.currentClass = t.errClass;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateExcelStudents = () => {
    if (!excelStudents.length) return t.uploadExcelFirst;

    for (let i = 0; i < excelStudents.length; i++) {
      const student = excelStudents[i];

      if (!student.name_bn && !student.name) {
        return t.rowNoName(String(i + 2));
      }

      if (!student.academic_division) {
        return t.rowNoDivision(String(i + 2));
      }

      if (!student.current_class && !student.class_id) {
        return t.rowNoClass(String(i + 2));
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
      name_en: student.name_en || null,
      nid: student.nid || null,
      age: calculateAge(student.dob),
      father_name: student.father_name || null,
      father_arabic_name: student.father_arabic_name || null,
      father_name_en: student.father_name_en || null,
      father_nid: student.father_nid || null,
      father_occupation: student.father_occupation || null,
      mother_name: student.mother_name || null,
      mother_arabic_name: student.mother_arabic_name || null,
      mother_name_en: student.mother_name_en || null,
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
      { key: "name_en", required: false },
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
      { key: "father_name_en", required: false },
      { key: "father_nid", required: false },
      { key: "father_occupation", required: false },
      { key: "mother_name", required: false },
      { key: "mother_arabic_name", required: false },
      { key: "mother_name_en", required: false },
      { key: "mother_nid", required: false },
      { key: "mother_occupation", required: false },
      { key: "division", required: false },
      { key: "district", required: false },
      { key: "thana", required: false },
      { key: "village", required: false },
      { key: "image", required: false },
    ];

    const headerRow = columns.map((col) => (col.required ? `${col.key} *` : col.key));

    const sample: Record<string, string | number> = {
      name_bn: "মোঃ আব্দুল্লাহ", arabic_name: "", name_en: "Abdullah", nid: "1234567890",
      gender: "1", dob: "2015-01-20", academic_year: String(new Date().getFullYear()),
      academic_division: academicExcelId(divisions[0]), previous_class: "",
      current_class: academicExcelId(classes[0]), guardian_phone: "01700000000",
      father_name: "Abdul Karim", father_name_en: "Abdul Karim", father_occupation: "Business",
      mother_name: "Amina", mother_name_en: "Amina", mother_occupation: "Home maker",
      division: "Dhaka", district: "Dhaka", thana: "Mirpur", village: "Kazipara",
    };
    const sampleRow = columns.map((column) => sample[column.key] ?? "");

    const ws = XLSX.utils.aoa_to_sheet([
      [t.templateNote],
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
      [t.genderGuide],
      ["ID", t.guideName],
      [1, t.male],
      [2, t.female],
      [],
      [t.divisionGuide],
      ["ID", t.divisionName],
      ...divisions.map((d) => [academicExcelId(d), d.division_name_bn]),
      [],
      [t.classGuide],
      ["ID", t.className, t.divisionId, "Excel Code (previous_class)"],
      ...classes.map((c) => {
        const divisionNo = academicExcelId(divisions.find((d) => d.division_id === c.division_id));
        return [academicExcelId(c), c.class_name_bn, divisionNo, `${divisionNo}/${academicExcelId(c)}`];
      }),
    ];

    const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
    guideWs["!cols"] = [{ wch: 15 }, { wch: 35 }, { wch: 18 }, { wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admission Template");
    XLSX.utils.book_append_sheet(wb, guideWs, "Guide");
    const divisionRefs = divisions.map((d) => ({ id: d.division_id, local_no: d.local_no }));
    const classRefs = classes.map((c) => ({
      id: c.class_id, local_no: c.local_no, scope_id: c.division_id ?? 0,
      scope_key: String(academicExcelId(divisions.find((d) => d.division_id === c.division_id))),
    }));
    const currentClassRefs = classRefs.map((c) => ({ ...c, parent_fields: ["academic_division", "division_id"] }));
    appendAcademicExcelIds(XLSX, wb, {
      academic_division: divisionRefs, division_id: divisionRefs,
      current_class: currentClassRefs, class_id: currentClassRefs, previous_class: classRefs, previous_class_id: classRefs,
    });
    XLSX.writeFile(wb, "admission-template.xlsx");
  };

  const handleExcelSubmit = async () => {
    const error = validateExcelStudents();
    if (error) return useToastStore.getState().show(error, "error");

    try {
      setLoading(true);

      // Every row also gets a guardian + fee invoices after the insert, so a
      // few dozen rows easily outlive the client's default 20s timeout.
      const res = await progressTask.run(
        {
          title: t.progressBulkTitle,
          steps: [t.progressValidate, t.progressSaveStudent, t.progressSaveGuardian, t.progressFinish],
          estimate: true,
        },
        () =>
          api.post("/students/admission/bulk", { students: makeExcelPayload() }, { timeout: 300_000 }),
      );

      setBulkResult({
        inserted: res.data?.inserted || 0,
        updated: res.data?.updated || 0,
        preview: res.data?.preview || [],
      });
      void refreshSidebarCounts();
      setExcelStudents([]);
    } catch (err: any) {
      useToastStore
        .getState()
        .show(
          err?.response?.data?.message ||
            (err?.code === "ECONNABORTED"
              ? getText(admissionPageText).serverSlow
              : getText(admissionPageText).bulkFailed),
          "error",
        );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (admissionMode === "existing" && !previousStudent) {
      useToastStore.getState().show(t.selectExistingFirst, "error");
      return;
    }
    if (nidLookupLoading || loading) return;
    const isValid = validateForm();
    if (!isValid) {
      useToastStore.getState().show(t.fillRequired, "error");
      return;
    }

    const payload = {
      admission_mode: admissionMode,
      existing_student_id: previousStudent?.id,
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
      alt_guardian_arabic_name: formData.hasAltGuardian ? formData.altGuardianArabicName || null : null,
      alt_guardian_name_en: formData.hasAltGuardian ? formData.altGuardianNameEn || null : null,
      alt_guardian_relation: formData.hasAltGuardian ? formData.altGuardianRelation || null : null,
      alt_guardian_address: formData.hasAltGuardian ? formData.altGuardianAddress || null : null,
      alt_guardian_phone: formData.hasAltGuardian
        ? cleanPhone(formData.altGuardianPhone) || null
        : null,
      arabic_name: formData.arabicName || null,
      name_en: formData.nameEn || null,
      nid: formData.nid || null,
      age: calculateAge(formData.dob),
      father_name: formData.fatherName || null,
      father_arabic_name: formData.fatherArabicName || null,
      father_name_en: formData.fatherNameEn || null,
      father_nid: formData.fatherNid || null,
      father_occupation: formData.fatherOccupation || null,
      mother_name: formData.motherName || null,
      mother_arabic_name: formData.motherArabicName || null,
      mother_name_en: formData.motherNameEn || null,
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

      const res = await progressTask.run(
        {
          title: t.progressSingleTitle,
          steps: [t.progressValidate, t.progressSaveStudent, t.progressSaveGuardian, t.progressFinish],
          estimate: true,
        },
        () => api.post("/students/admission", payload),
      );

      // Admission fee collection now happens from হিসাব বিভাগ's "ভর্তি ফি
      // পেন্ডিং" page after a Muhtamim reviews the application, not inline
      // here at submission time. The form is left as-is (rather than reset
      // immediately) until the office staff dismisses the success modal
      // below - see handleStartNewAdmission.
      setSuccessInfo({
        isReAdmission: res.data?.action === "re_admitted",
        registrationNo: res.data?.registrationNo ? String(res.data.registrationNo) : "-",
        roll: res.data?.roll ? String(res.data.roll) : "-",
        previousAcademicYear: res.data?.previousAcademicYear || "-",
        academicYear: formData.academicYear,
      });
      void refreshSidebarCounts();
    } catch (err: any) {
      useToastStore.getState().show(err?.response?.data?.message || getText(admissionPageText).failed, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6">
      <ProgressOverlay {...progressTask.overlayProps} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center relative gap-2 sm:gap-3 mb-6">
        <button
          type="button"
          onClick={() => setBulkModalOpen(true)}
          className="self-end sm:self-auto sm:absolute sm:end-0 sm:top-1/2 sm:-translate-y-1/2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-normal whitespace-nowrap"
        >
          {t.bulkUpload}
        </button>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center break-words">
          {t.pageTitle}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <fieldset disabled={loading} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <legend className="px-2 font-semibold">{t.studentType}</legend>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {(["new", "existing"] as const).map((mode) => (
              <label key={mode} className={`flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm font-normal sm:gap-2 sm:px-3 ${admissionMode === mode ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "border-gray-300 dark:border-slate-600"}`}>
                <input className="shrink-0" type="radio" name="studentType" value={mode} checked={admissionMode === mode} onChange={() => changeAdmissionMode(mode)} />
                <span className="min-w-0 leading-snug">{mode === "new" ? t.newStudent : t.existingStudent}</span>
              </label>
            ))}
          </div>
          {admissionMode === "existing" && (
            <div className="mt-4">
              {previousStudent ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium">{previousStudent.name_bn} · {t.registrationNo}: {previousStudent.registration_no || "—"}</p>
                </div>
              ) : (
                <>
                  <label htmlFor="existing-student-search" className="mb-2 block text-sm font-medium">{t.findStudent}</label>
                  <input id="existing-student-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t.searchPlaceholder} maxLength={100} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800" />
                  <div aria-live="polite" className="mt-2 text-sm">
                    {searchLoading ? t.searching : searchError ? t.searchFailed : !canSearch ? t.searchHint : searchResults.length === 0 ? t.noStudents : t.searchLimit}
                  </div>
                  <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-200 dark:divide-slate-700">
                    {searchResults.map((student) => (
                      <li key={student.id}>
                        <button type="button" onClick={() => selectPreviousStudent(student)} className="w-full rounded-lg p-3 text-start hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800">
                          <span className="block font-semibold">{student.name_bn}{student.name_en ? ` (${student.name_en})` : ""}</span>
                          <span className="block text-sm text-gray-600 dark:text-slate-400">{t.registrationNo}: {student.registration_no || "—"} · {student.current_class || "—"} · {student.academic_year || "—"}</span>
                          <span className="block text-sm text-gray-600 dark:text-slate-400">{t.fatherName}: {student.father_name || "—"} · {t.birthRegistration}: {student.nid || "—"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </fieldset>
        {(nidLookupLoading || previousStudent) && (
          <PreviousStudentBanner
            loading={nidLookupLoading}
            studentName={previousStudent?.name_bn || ""}
            previousAcademicYear={previousStudent?.academic_year || ""}
            previousClassName={previousStudent?.current_class || null}
            onDismiss={handleDismissPreviousStudent}
          />
        )}

        <fieldset disabled={loading || (admissionMode === "existing" && !previousStudent)} className="min-w-0 space-y-4 disabled:opacity-60 sm:space-y-6">
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
          <SubmitButton loading={loading || nidLookupLoading} isReAdmission={Boolean(previousStudent)} />
        </fieldset>
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

      <Modal
        open={Boolean(successInfo)}
        title={successInfo?.isReAdmission ? t.readmissionSuccess : t.admissionSuccess}
        onClose={handleStartNewAdmission}
        maxWidthClassName="max-w-md"
      >
        {successInfo && (
          <div className="space-y-4">
            {successInfo.isReAdmission && (
              <p className="text-sm text-gray-600 dark:text-slate-400">
                {t.previousSession} <span className="font-semibold">{successInfo.previousAcademicYear}</span> → {t.newSession}{" "}
                <span className="font-semibold">{successInfo.academicYear}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">{t.registrationNo}</div>
                <div className="text-lg font-bold text-gray-800 dark:text-slate-100">
                  {successInfo.registrationNo}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-slate-800">
                <div className="text-xs text-gray-500 dark:text-slate-400">{t.rollNo}</div>
                <div className="text-lg font-bold text-gray-800 dark:text-slate-100">{successInfo.roll}</div>
              </div>
            </div>

            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t.awaitingApproval}
            </p>

            <button
              ref={newFormButtonRef}
              type="button"
              onClick={handleStartNewAdmission}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {t.newAdmissionForm}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdmissionPage;
