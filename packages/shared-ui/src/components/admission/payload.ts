import type { AdmissionFormData } from "./types";

const cleanPhone = (phone: string) => phone.replace(/[^0-9]/g, "");

export function buildAdmissionPayload(form: AdmissionFormData) {
  return {
    name_bn: form.name.trim(),
    arabic_name: form.arabicName || null,
    name_en: form.nameEn || null,
    nid: form.nid || null,
    gender: form.gender === null ? null : Number(form.gender),
    dob: form.dob || null,
    age: form.age,
    blood_group: form.bloodGroup || null,
    residency_type:
      form.residencyType === null ? null : Number(form.residencyType),
    is_orphan: form.isOrphan ? 1 : 0,
    division_id: Number(form.academicDivision),
    class_id: Number(form.currentClass),
    academic_year: form.academicYear,
    admission_date: form.admissionDate,
    previous_class_id: form.previousClass ? Number(form.previousClass) : null,
    previous_institution: form.previousInstitution || null,
    previous_result: form.previousResult || null,
    father_name: form.fatherName || null,
    father_arabic_name: form.fatherArabicName || null,
    father_name_en: form.fatherNameEn || null,
    father_nid: form.fatherNid || null,
    father_occupation: form.fatherOccupation || null,
    mother_name: form.motherName || null,
    mother_arabic_name: form.motherArabicName || null,
    mother_name_en: form.motherNameEn || null,
    mother_nid: form.motherNid || null,
    mother_occupation: form.motherOccupation || null,
    guardian_phone: cleanPhone(
      form.hasAltGuardian ? form.altGuardianPhone : form.parentPhone,
    ),
    guardian_phone_2: form.parentPhone2 ? cleanPhone(form.parentPhone2) : null,
    alt_guardian_name: form.hasAltGuardian
      ? form.altGuardianName || null
      : null,
    alt_guardian_arabic_name: form.hasAltGuardian
      ? form.altGuardianArabicName || null
      : null,
    alt_guardian_name_en: form.hasAltGuardian
      ? form.altGuardianNameEn || null
      : null,
    alt_guardian_relation: form.hasAltGuardian
      ? form.altGuardianRelation || null
      : null,
    alt_guardian_address: form.hasAltGuardian
      ? form.altGuardianAddress || null
      : null,
    alt_guardian_phone: form.hasAltGuardian
      ? cleanPhone(form.altGuardianPhone) || null
      : null,
    division: form.division || null,
    district: form.district || null,
    thana: form.thana || null,
    village: form.village || null,
    image: form.image || null,
  };
}
