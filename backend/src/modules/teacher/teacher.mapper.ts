/**
 * The Teacher list/detail endpoints previously returned the raw Prisma row
 * as-is, which uses camelCase field names (nameBn, fatherName, divisionId,
 * ...). Every consumer of these endpoints (TeacherListPage, TeacherPage,
 * TeacherProfilePage) is written against snake_case field names, matching
 * the rest of the API and the teacher creation payload itself. That
 * mismatch meant `teacher.name_bn`, `teacher.division_id`, etc. were always
 * `undefined` on the frontend - silently leaving the teacher name (and
 * every other field) blank in the list and profile pages.
 *
 * This mapper is the single place responsible for translating a Prisma
 * Teacher row (optionally including `divisionRef`) into the API-facing
 * shape. Mirrors student.mapper.ts.
 */
export const toTeacherApiDto = (row: Record<string, any>) => {
  const { divisionRef, ...t } = row;

  return {
    id: t.id,
    registration_no: t.registrationNo ?? null,
    name_bn: t.nameBn,
    name_ar: t.nameAr ?? null,
    nid: t.nid ?? null,
    gender: t.gender ?? null,
    dob: t.dob ?? null,
    age: t.age ?? null,

    division_id: t.divisionId ?? null,
    academic_division: t.divisionId ?? null,
    academic_division_name: divisionRef?.nameBn ?? null,

    phone: t.phone ?? null,
    email: t.email ?? null,

    designation: t.designation ?? null,
    department: t.department ?? null,
    qualification: t.qualification ?? null,

    experience_year: t.experienceYear ?? null,
    experience_month: t.experienceMonth ?? null,

    joining_date: t.joiningDate ?? null,
    salary: t.salary ?? null,

    father_name: t.fatherName ?? null,
    father_name_ar: t.fatherNameAr ?? null,
    father_nid: t.fatherNid ?? null,
    father_occupation: t.fatherOccupation ?? null,

    mother_name: t.motherName ?? null,
    mother_nid: t.motherNid ?? null,
    mother_occupation: t.motherOccupation ?? null,

    parent_phone: t.parentPhone ?? null,

    division: t.division ?? null,
    district: t.district ?? null,
    thana: t.thana ?? null,
    village: t.village ?? null,

    image: t.image ?? null,
  };
};
