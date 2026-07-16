import { Prisma } from "@prisma/client";
import { TenantNotResolvedError } from "../../shared/errors";
import { admissionRepository, AdmissionRepository } from "./admission.repository";
import { AdmissionRequestDto } from "./admission.dto";
import { AdmissionValidationError } from "./admission.types";

export class AdmissionService {
  constructor(private readonly repository: AdmissionRepository = admissionRepository) {}

  async admit(body: AdmissionRequestDto, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!body.name || !body.nid || !body.division_id || !body.class_id || !body.academic_year) {
      throw new AdmissionValidationError();
    }

    // NOTE: original raw-SQL payload had `name_ar`, but the students table
    // has no such column (only `arabic_name`) - that field was silently
    // being dropped/erroring before. Mapped to the real column here.
    const created = await this.repository.create({
      madrasaId,

      divisionId: Number(body.division_id),
      classId: Number(body.class_id),
      academicYear: String(body.academic_year),
      previousClassId: body.previous_class_id ? Number(body.previous_class_id) : null,

      nameBn: body.name || null,
      arabicName: body.arabicName || null,
      nid: body.nid || null,
      gender: (body.gender || null) as unknown as number | null,
      dob: body.dob ? new Date(body.dob) : null,
      age: body.age ? Number(body.age) : null,

      fatherName: body.fatherName || null,
      fatherArabicName: body.fatherArabicName || null,
      fatherNid: body.fatherNid || null,
      fatherOccupation: body.fatherOccupation || null,

      motherName: body.motherName || null,
      motherNid: body.motherNid || null,
      motherOccupation: body.motherOccupation || null,

      guardianPhone: body.parentPhone || null,

      division: body.division || null,
      district: body.district || null,
      thana: body.thana || null,
      village: body.village || null,

      image: body.image || null,

      admissionDate: new Date(),
    } as Prisma.StudentUncheckedCreateInput);

    return created.id;
  }
}

export const admissionService = new AdmissionService();
