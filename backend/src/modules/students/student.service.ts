import { Prisma } from "@prisma/client";
import { studentRepository, StudentRepository } from "./student.repository";
import { isValidDate, clean, toNumber, toGenderNumber } from "../../shared/utils/parse.util";
import { BadRequestError } from "../../shared/errors";
import {
  STUDENT_REQUIRED_FIELDS,
  STUDENT_FIELD_MAP,
} from "./student.constants";
import {
  BulkAdmissionResult,
  BulkAdmissionRow,
  MissingFieldsError,
  StudentListFilters,
  StudentListItem,
  StudentNotFoundError,
  TenantNotResolvedError,
} from "./student.types";
import { StudentAdmissionRequestDto } from "./student.dto";

const validateRequiredFields = (body: Record<string, unknown>): string[] => {
  return STUDENT_REQUIRED_FIELDS.filter((field) => {
    const value = body[field];
    if (typeof value === "string") return value.trim() === "";
    return value === undefined || value === null;
  });
};

const makeStudentData = (body: Record<string, any>, madrasaId: number) => ({
  madrasaId,
  nameBn: String(body.name_bn || "").trim(),
  arabicName: clean(body.arabic_name),
  nid: clean(body.nid),
  gender: toGenderNumber(body.gender),
  dob: body.dob ? new Date(body.dob) : null,
  age: toNumber(body.age),

  divisionId: toNumber(body.division_id),
  classId: toNumber(body.class_id),
  academicYear: String(body.academic_year || new Date().getFullYear()),
  previousClassId: toNumber(body.previous_class_id),

  fatherName: clean(body.father_name),
  fatherArabicName: clean(body.father_arabic_name),
  fatherNid: clean(body.father_nid),
  fatherOccupation: clean(body.father_occupation),

  motherName: clean(body.mother_name),
  motherNid: clean(body.mother_nid),
  motherOccupation: clean(body.mother_occupation),

  guardianPhone: clean(body.guardian_phone),

  division: clean(body.division),
  district: clean(body.district),
  thana: clean(body.thana),
  village: clean(body.village),

  image: clean(body.image),
});

export class StudentService {
  constructor(private readonly repository: StudentRepository = studentRepository) {}

  async listStudents(
    madrasaId: number | undefined,
    filters: StudentListFilters,
  ): Promise<StudentListItem[]> {
    if (!madrasaId) throw new TenantNotResolvedError();

    const where: Prisma.StudentWhereInput = { madrasaId };
    if (filters.divisionId !== undefined) where.divisionId = filters.divisionId;
    if (filters.classId !== undefined) where.classId = filters.classId;
    if (filters.academicYear !== undefined) where.academicYear = filters.academicYear;

    const rows = await this.repository.findMany(where);

    return rows.map(({ classRef, ...s }) => ({
      ...s,
      current_class: classRef?.nameBn ?? null,
    })) as StudentListItem[];
  }

  async getStudentDetail(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const row = await this.repository.findByIdForTenant(id, madrasaId);
    if (!row) throw new StudentNotFoundError();

    const { classRef, ...s } = row as any;
    return { ...s, current_class: classRef?.nameBn ?? null };
  }

  async admitStudent(body: StudentAdmissionRequestDto, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestError("Empty request body (Check express.json())");
    }

    const missing = validateRequiredFields(body);
    if (missing.length > 0) {
      throw new MissingFieldsError(missing, body);
    }

    if (body.dob && !isValidDate(body.dob)) {
      throw new BadRequestError("Invalid DOB");
    }

    const data = makeStudentData(body, madrasaId);
    const created = await this.repository.create(data as Prisma.StudentUncheckedCreateInput);

    return created.id;
  }

  async admitStudentsBulk(
    students: StudentAdmissionRequestDto[],
    madrasaId: number | undefined,
  ): Promise<BulkAdmissionResult> {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!Array.isArray(students) || students.length === 0) {
      throw new BadRequestError("Students array is required");
    }

    return this.repository.runTransaction(async (tx) => {
      let inserted = 0;
      let updated = 0;
      const preview: BulkAdmissionRow[] = [];

      for (let index = 0; index < students.length; index++) {
        const student = students[index];
        const missing = validateRequiredFields(student);
        if (missing.length > 0) {
          throw new Error(`Row ${index + 1}: Required fields missing - ${missing.join(", ")}`);
        }
        if (student.dob && !isValidDate(student.dob)) {
          throw new Error(`Row ${index + 1}: Invalid DOB`);
        }

        const nid = clean(student.nid) as string | null;
        let existing: any = null;
        if (nid) {
          existing = await this.repository.findByNidOnTx(tx, madrasaId, nid);
        }

        const data = makeStudentData(student, madrasaId);

        if (existing) {
          const { madrasaId: _omit, ...updateData } = data;
          const changes = Object.entries(updateData)
            .map(([field, value]) => ({ field, old: existing[field], new: value }))
            .filter((change) => String(change.old ?? "") !== String(change.new ?? ""));

          if (changes.length) {
            await this.repository.updateOnTx(tx, existing.id, updateData);
          }
          updated++;
          preview.push({ row: index + 1, action: "update", id: existing.id, nid, changes });
        } else {
          const created = await this.repository.createOnTx(
            tx,
            data as Prisma.StudentUncheckedCreateInput,
          );
          inserted++;
          preview.push({ row: index + 1, action: "create", id: created.id, nid, changes: [] });
        }
      }

      return { inserted, updated, preview };
    });
  }

  async updateStudent(id: number, madrasaId: number | undefined, body: Record<string, any>) {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (body.dob && !isValidDate(body.dob)) {
      throw new BadRequestError("Invalid DOB");
    }

    const data: Record<string, any> = {};
    for (const key of Object.keys(body)) {
      const field = STUDENT_FIELD_MAP[key];
      if (!field) continue;

      if (key === "gender") {
        data[field] = toGenderNumber(body[key]);
      } else if (key === "age" || key === "division_id" || key === "class_id" || key === "previous_class_id") {
        data[field] = toNumber(body[key]);
      } else if (key === "dob") {
        const v = clean(body[key]);
        data[field] = v ? new Date(v as string) : null;
      } else {
        data[field] = clean(body[key]);
      }
    }

    if (!Object.keys(data).length) {
      throw new BadRequestError("No valid data to update");
    }

    const result = await this.repository.updateManyForTenant(id, madrasaId, data);
    return result.count;
  }

  async deleteStudent(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const result = await this.repository.deleteManyForTenant(id, madrasaId);
    return result.count;
  }
}

export const studentService = new StudentService();
