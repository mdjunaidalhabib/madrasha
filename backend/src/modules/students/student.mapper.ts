import { StudentApiDto } from "./student.types";

/**
 * The Student list/detail/lookup endpoints previously returned the raw
 * Prisma row as-is, which uses camelCase field names (nameBn, fatherName,
 * divisionId, academicYear, ...). Every consumer of these endpoints
 * (StudentListPage, StudentProfilePage, the admission NID-lookup flow) is
 * written against snake_case field names, matching the rest of the API and
 * the admission request payload itself. That mismatch meant `student.name_bn`,
 * `student.academic_year`, etc. were always `undefined` on the frontend -
 * silently emptying the student list (the academic-year filter compares
 * against `undefined` and never matches) and leaving the profile page blank.
 *
 * This mapper is the single place responsible for translating a Prisma
 * Student row (optionally including `classRef`) into the API-facing shape.
 */
export const toStudentApiDto = (row: Record<string, any>): StudentApiDto => {
  const { classRef, ...s } = row;

  return {
    id: s.id,
    registration_no: s.registrationNo ?? null,
    name_bn: s.nameBn,
    arabic_name: s.arabicName ?? null,
    nid: s.nid ?? null,
    gender: s.gender ?? null,
    dob: s.dob ?? null,
    age: s.age ?? null,
    blood_group: s.bloodGroup ?? null,
    residency_type: s.residencyType ?? null,
    is_orphan: s.isOrphan ?? null,
    roll: s.roll ?? null,
    division_id: s.divisionId ?? null,
    class_id: s.classId ?? null,
    academic_year: s.academicYear,
    previous_class_id: s.previousClassId ?? null,
    previous_institution: s.previousInstitution ?? null,
    previous_result: s.previousResult ?? null,
    admission_date: s.admissionDate ?? null,
    current_class: classRef?.nameBn ?? null,
    father_name: s.fatherName ?? null,
    father_arabic_name: s.fatherArabicName ?? null,
    father_nid: s.fatherNid ?? null,
    father_occupation: s.fatherOccupation ?? null,
    mother_name: s.motherName ?? null,
    mother_nid: s.motherNid ?? null,
    mother_occupation: s.motherOccupation ?? null,
    guardian_phone: s.guardianPhone ?? null,
    guardian_phone_2: s.guardianPhone2 ?? null,
    alt_guardian_name: s.altGuardianName ?? null,
    alt_guardian_relation: s.altGuardianRelation ?? null,
    alt_guardian_address: s.altGuardianAddress ?? null,
    alt_guardian_phone: s.altGuardianPhone ?? null,
    division: s.division ?? null,
    district: s.district ?? null,
    thana: s.thana ?? null,
    village: s.village ?? null,
    image: s.image ?? null,
    admission_status: s.admissionStatus ?? "APPROVED",
    admission_type: s.admissionType ?? "NEW",
    rejection_reason: s.rejectionReason ?? null,
  };
};
