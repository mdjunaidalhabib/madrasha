import { Prisma } from "@prisma/client";
import { studentRepository, StudentRepository } from "./student.repository";
import { isValidDate, clean, toNumber, toGenderNumber } from "../../shared/utils/parse.util";
import { BadRequestError, ForbiddenError } from "../../shared/errors";
import { STUDENT_REQUIRED_FIELDS, STUDENT_FIELD_MAP } from "./student.constants";
import {
  AdmissionResult,
  BulkAdmissionResult,
  BulkAdmissionRow,
  MissingFieldsError,
  PreviousStudentLookup,
  StudentListFilters,
  StudentListItem,
  StudentNotFoundError,
  TenantNotResolvedError,
} from "./student.types";
import { toStudentApiDto } from "./student.mapper";
import { StudentAdmissionRequestDto } from "./student.dto";

const validateRequiredFields = (body: Record<string, unknown>): string[] => {
  return STUDENT_REQUIRED_FIELDS.filter((field) => {
    const value = body[field];
    if (typeof value === "string") return value.trim() === "";
    return value === undefined || value === null;
  });
};

const isManualRollOverrideRequested = (value: unknown): boolean =>
  value === true ||
  String(value || "")
    .trim()
    .toLowerCase() === "true";

const validateManualRollOverride = (
  body: Record<string, any>,
  allowManualRollOverride: boolean,
): number | null => {
  if (!isManualRollOverrideRequested(body.manual_roll_override)) return null;

  if (!allowManualRollOverride) {
    throw new ForbiddenError("শুধু মুহতামিম ম্যানুয়ালি রোল পরিবর্তন করতে পারবেন");
  }

  const roll = toNumber(body.roll);
  if (!roll || !Number.isInteger(roll) || roll < 1) {
    throw new BadRequestError("Roll number must be a positive integer");
  }

  return roll;
};

const makeStudentData = (body: Record<string, any>, madrasaId: number) => ({
  madrasaId,
  nameBn: String(body.name_bn || "").trim(),
  arabicName: clean(body.arabic_name),
  nid: clean(body.nid),
  gender: toGenderNumber(body.gender),
  dob: body.dob ? new Date(body.dob) : null,
  age: toNumber(body.age),
  // Roll is assigned explicitly below. Unflagged client values are ignored so
  // automatic assignment remains the authoritative default.
  roll: null as number | null,

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

    return rows.map(toStudentApiDto);
  }

  async getStudentDetail(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const row = await this.repository.findByIdForTenant(id, madrasaId);
    if (!row) throw new StudentNotFoundError();

    return toStudentApiDto(row);
  }

  async lookupByNid(
    nid: string,
    madrasaId: number | undefined,
  ): Promise<PreviousStudentLookup | null> {
    if (!madrasaId) throw new TenantNotResolvedError();

    const cleanedNid = clean(nid) as string | null;
    if (!cleanedNid) return null;

    const row = await this.repository.findByNid(madrasaId, cleanedNid);
    if (!row) return null;

    return toStudentApiDto(row);
  }

  async admitStudent(
    body: StudentAdmissionRequestDto,
    madrasaId: number | undefined,
    allowManualRollOverride = false,
  ): Promise<AdmissionResult> {
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

    const manualRoll = validateManualRollOverride(body, allowManualRollOverride);
    const classId = toNumber(body.class_id);
    const academicYear = String(body.academic_year || new Date().getFullYear());

    if (!classId) throw new BadRequestError("class_id is required");

    return this.repository.runTransaction(async (tx) => {
      const nid = clean(body.nid) as string | null;
      const existing = nid ? await this.repository.findByNidOnTx(tx, madrasaId, nid) : null;

      const data = makeStudentData(body, madrasaId);

      if (manualRoll !== null) {
        data.roll = manualRoll;
      } else if (
        existing &&
        existing.classId === classId &&
        existing.academicYear === academicYear &&
        existing.roll
      ) {
        // Re-submitting the same class/session must not unnecessarily change
        // the student's existing roll.
        data.roll = existing.roll;
      } else {
        await this.repository.lockRollScopeOnTx(tx, madrasaId, classId);
        data.roll =
          (await this.repository.getMaxRollOnTx(tx, madrasaId, classId, academicYear)) + 1;
      }

      if (existing) {
        const updateData = { ...data } as Record<string, any>;
        delete updateData.madrasaId;
        await this.repository.updateManyForTenantOnTx(tx, existing.id, madrasaId, updateData);

        return {
          studentId: existing.id,
          action: "re_admitted" as const,
          previousAcademicYear: existing.academicYear,
          roll: data.roll!,
        };
      }

      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
      const nextRegistrationNo =
        (await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId)) + 1;
      const created = await this.repository.createOnTx(tx, {
        ...data,
        registrationNo: nextRegistrationNo,
      } as Prisma.StudentUncheckedCreateInput);

      return { studentId: created.id, action: "created" as const, roll: data.roll! };
    });
  }

  async admitStudentsBulk(
    students: StudentAdmissionRequestDto[],
    madrasaId: number | undefined,
    allowManualRollOverride = false,
  ): Promise<BulkAdmissionResult> {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!Array.isArray(students) || students.length === 0) {
      throw new BadRequestError("Students array is required");
    }

    const prepared = students.map((student, index) => {
      const missing = validateRequiredFields(student);
      if (missing.length > 0) {
        throw new BadRequestError(
          `Row ${index + 1}: Required fields missing - ${missing.join(", ")}`,
        );
      }
      if (student.dob && !isValidDate(student.dob)) {
        throw new BadRequestError(`Row ${index + 1}: Invalid DOB`);
      }

      const classId = toNumber(student.class_id);
      if (!classId) throw new BadRequestError(`Row ${index + 1}: class_id is required`);

      return {
        student,
        classId,
        academicYear: String(student.academic_year || new Date().getFullYear()),
        manualRoll: validateManualRollOverride(student, allowManualRollOverride),
      };
    });

    return this.repository.runTransaction(async (tx) => {
      // Always acquire class locks in a stable order, then the registration
      // lock. This avoids duplicate auto numbers and prevents deadlocks.
      const classIds = [...new Set(prepared.map((row) => row.classId))].sort((a, b) => a - b);
      for (const classId of classIds) {
        await this.repository.lockRollScopeOnTx(tx, madrasaId, classId);
      }
      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);

      let inserted = 0;
      let updated = 0;
      const preview: BulkAdmissionRow[] = [];
      let nextRegistrationNo = await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId);
      const rollCounters = new Map<string, number>();

      for (let index = 0; index < prepared.length; index++) {
        const { student, classId, academicYear, manualRoll } = prepared[index];
        const nid = clean(student.nid) as string | null;
        const existing = nid ? await this.repository.findByNidOnTx(tx, madrasaId, nid) : null;
        const data = makeStudentData(student, madrasaId);

        if (manualRoll !== null) {
          data.roll = manualRoll;
        } else if (
          existing &&
          existing.classId === classId &&
          existing.academicYear === academicYear &&
          existing.roll
        ) {
          data.roll = existing.roll;
        } else {
          const key = `${classId}:${academicYear}`;
          if (!rollCounters.has(key)) {
            rollCounters.set(
              key,
              await this.repository.getMaxRollOnTx(tx, madrasaId, classId, academicYear),
            );
          }
          const nextRoll = rollCounters.get(key)! + 1;
          rollCounters.set(key, nextRoll);
          data.roll = nextRoll;
        }

        if (existing) {
          const updateData = { ...data } as Record<string, any>;
          delete updateData.madrasaId;
          const changes = Object.entries(updateData)
            .map(([field, value]) => ({ field, old: (existing as any)[field], new: value }))
            .filter((change) => String(change.old ?? "") !== String(change.new ?? ""));

          if (changes.length) {
            await this.repository.updateOnTx(tx, existing.id, updateData);
          }
          updated++;
          preview.push({
            row: index + 1,
            action: "update",
            id: existing.id,
            nid,
            name: data.nameBn,
            previousAcademicYear: existing.academicYear ?? null,
            academicYear: data.academicYear,
            roll: data.roll!,
            changes,
          });
        } else {
          nextRegistrationNo += 1;
          const created = await this.repository.createOnTx(tx, {
            ...data,
            registrationNo: nextRegistrationNo,
          } as Prisma.StudentUncheckedCreateInput);
          inserted++;
          preview.push({
            row: index + 1,
            action: "create",
            id: created.id,
            nid,
            name: data.nameBn,
            previousAcademicYear: null,
            academicYear: data.academicYear,
            roll: data.roll!,
            changes: [],
          });
        }
      }

      return { inserted, updated, preview };
    });
  }

  async updateStudent(
    id: number,
    madrasaId: number | undefined,
    body: Record<string, any>,
    allowManualRollOverride = false,
  ) {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (body.dob && !isValidDate(body.dob)) {
      throw new BadRequestError("Invalid DOB");
    }

    const manualRoll = validateManualRollOverride(body, allowManualRollOverride);

    return this.repository.runTransaction(async (tx) => {
      const existing = await this.repository.findByIdForTenantOnTx(tx, id, madrasaId);
      if (!existing) throw new StudentNotFoundError();

      const data: Record<string, any> = {};
      for (const key of Object.keys(body)) {
        // Roll is handled only through the explicit override flag below.
        if (key === "roll" || key === "manual_roll_override") continue;

        const field = STUDENT_FIELD_MAP[key];
        if (!field) continue;

        if (key === "gender") {
          data[field] = toGenderNumber(body[key]);
        } else if (
          key === "age" ||
          key === "division_id" ||
          key === "class_id" ||
          key === "previous_class_id"
        ) {
          data[field] = toNumber(body[key]);
        } else if (key === "dob") {
          const v = clean(body[key]);
          data[field] = v ? new Date(v as string) : null;
        } else {
          data[field] = clean(body[key]);
        }
      }

      const targetClassId = Number(data.classId ?? existing.classId);
      const targetAcademicYear = String(data.academicYear ?? existing.academicYear);
      const scopeChanged =
        targetClassId !== existing.classId || targetAcademicYear !== existing.academicYear;

      if (manualRoll !== null) {
        data.roll = manualRoll;
      } else if (scopeChanged) {
        await this.repository.lockRollScopeOnTx(tx, madrasaId, targetClassId);
        data.roll =
          (await this.repository.getMaxRollOnTx(tx, madrasaId, targetClassId, targetAcademicYear)) +
          1;
      }

      if (!Object.keys(data).length) {
        throw new BadRequestError("No valid data to update");
      }

      const result = await this.repository.updateManyForTenantOnTx(tx, id, madrasaId, data);
      return result.count;
    });
  }

  async getNextRoll(
    madrasaId: number | undefined,
    classId: number | undefined,
    academicYear: string | undefined,
  ): Promise<number> {
    if (!madrasaId) throw new TenantNotResolvedError();
    if (!classId) throw new BadRequestError("class_id is required");

    const year = academicYear || String(new Date().getFullYear());
    return (await this.repository.getMaxRoll(madrasaId, classId, year)) + 1;
  }

  async deleteStudent(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const result = await this.repository.deleteManyForTenant(id, madrasaId);
    return result.count;
  }
}

export const studentService = new StudentService();
