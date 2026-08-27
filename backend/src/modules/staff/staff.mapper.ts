// Translates a Prisma Staff row into the API-facing snake_case shape.
// Mirrors teacher.mapper.ts.
export const toStaffApiDto = (row: Record<string, any>) => {
  const s = row;

  return {
    id: s.id,
    registration_no: s.registrationNo ?? null,
    name_bn: s.nameBn,
    name_ar: s.nameAr ?? null,
    name_en: s.nameEn ?? null,
    nid: s.nid ?? null,
    gender: s.gender ?? null,
    dob: s.dob ?? null,
    age: s.age ?? null,

    phone: s.phone ?? null,
    email: s.email ?? null,

    designation: s.designation ?? null,
    department: s.department ?? null,
    qualification: s.qualification ?? null,

    experience_year: s.experienceYear ?? null,
    experience_month: s.experienceMonth ?? null,

    joining_date: s.joiningDate ?? null,
    salary: s.salary ?? null,

    father_name: s.fatherName ?? null,
    father_name_ar: s.fatherNameAr ?? null,
    father_name_en: s.fatherNameEn ?? null,
    father_nid: s.fatherNid ?? null,
    father_occupation: s.fatherOccupation ?? null,

    mother_name: s.motherName ?? null,
    mother_name_ar: s.motherNameAr ?? null,
    mother_name_en: s.motherNameEn ?? null,
    mother_nid: s.motherNid ?? null,
    mother_occupation: s.motherOccupation ?? null,

    parent_phone: s.parentPhone ?? null,

    division: s.division ?? null,
    district: s.district ?? null,
    thana: s.thana ?? null,
    village: s.village ?? null,

    image: s.image ?? null,
  };
};
