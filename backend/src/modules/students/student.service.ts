import { Prisma } from "@prisma/client";
import { studentRepository, StudentRepository } from "./student.repository";
import { isValidDate, clean, toNumber, toGenderNumber, toDateOrNull } from "../../shared/utils/parse.util";
import { BadRequestError } from "../../shared/errors";
import { STUDENT_REQUIRED_FIELDS, STUDENT_FIELD_MAP, STUDENT_BULK_UPDATE_FIELD_MAP } from "./student.constants";
import {
  AdmissionResult,
  BulkAdmissionResult,
  BulkAdmissionRow,
  BulkUpdateResult,
  BulkUpdateRow,
  MissingFieldsError,
  PreviousStudentLookup,
  StudentListFilters,
  StudentListItem,
  StudentNotFoundError,
  TenantNotResolvedError,
} from "./student.types";
import { toStudentApiDto } from "./student.mapper";
import { StudentAdmissionRequestDto, StudentBulkUpdateRowDto } from "./student.dto";
import { guardianService } from "../guardian/guardian.service";

const validateRequiredFields = (body: Record<string, unknown>): string[] => {
  return STUDENT_REQUIRED_FIELDS.filter((field) => {
    const value = body[field];
    if (typeof value === "string") return value.trim() === "";
    return value === undefined || value === null;
  });
};

const assertRollIsServerManaged = (body: Record<string, any>, rowLabel?: string) => {
  const suppliedRoll = body.roll;
  const hasRollValue =
    suppliedRoll !== undefined && suppliedRoll !== null && String(suppliedRoll).trim() !== "";
  const manualOverrideRequested =
    body.manual_roll_override === true ||
    String(body.manual_roll_override || "")
      .trim()
      .toLowerCase() === "true";

  if (hasRollValue || manualOverrideRequested) {
    const prefix = rowLabel ? `${rowLabel}: ` : "";
    throw new BadRequestError(
      `${prefix}রোল নম্বর ম্যানুয়ালি দেওয়া যাবে না। শ্রেণি ও শিক্ষাবর্ষ অনুযায়ী সিস্টেম স্বয়ংক্রিয়ভাবে রোল তৈরি করবে`,
    );
  }
};

const makeStudentData = (body: Record<string, any>, madrasaId: number) => ({
  madrasaId,
  nameBn: String(body.name_bn || "").trim(),
  arabicName: clean(body.arabic_name),
  nid: clean(body.nid),
  gender: toGenderNumber(body.gender),
  dob: body.dob ? new Date(body.dob) : null,
  age: toNumber(body.age),
  bloodGroup: clean(body.blood_group),
  residencyType: toNumber(body.residency_type),
  isOrphan: toNumber(body.is_orphan) ?? 0,
  // Roll is assigned explicitly below by the server. Client-provided roll values
  // are rejected before this function is called.
  roll: null as number | null,

  divisionId: toNumber(body.division_id),
  classId: toNumber(body.class_id),
  academicYear: String(body.academic_year || new Date().getFullYear()),
  previousClassId: toNumber(body.previous_class_id),
  previousInstitution: clean(body.previous_institution),
  previousResult: clean(body.previous_result),
  admissionDate: body.admission_date ? toDateOrNull(body.admission_date) : undefined,

  fatherName: clean(body.father_name),
  fatherArabicName: clean(body.father_arabic_name),
  fatherNid: clean(body.father_nid),
  fatherOccupation: clean(body.father_occupation),

  motherName: clean(body.mother_name),
  motherNid: clean(body.mother_nid),
  motherOccupation: clean(body.mother_occupation),

  guardianPhone: clean(body.guardian_phone),
  guardianPhone2: clean(body.guardian_phone_2),

  altGuardianName: clean(body.alt_guardian_name),
  altGuardianRelation: clean(body.alt_guardian_relation),
  altGuardianAddress: clean(body.alt_guardian_address),
  altGuardianPhone: clean(body.alt_guardian_phone),

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
    options?: { forcePending?: boolean },
  ): Promise<AdmissionResult> {
    if (!madrasaId) throw new TenantNotResolvedError();
    const forcePending = options?.forcePending === true;

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

    assertRollIsServerManaged(body);
    const classId = toNumber(body.class_id);
    const academicYear = String(body.academic_year || new Date().getFullYear());

    if (!classId) throw new BadRequestError("class_id is required");

    const result = await this.repository.runTransaction(async (tx) => {
      const nid = clean(body.nid) as string | null;

      if (nid) {
        await this.repository.lockStudentIdentityOnTx(tx, madrasaId, nid);
      }

      let existing = nid ? await this.repository.findByNidOnTx(tx, madrasaId, nid) : null;
      if (existing) {
        await this.repository.lockStudentRecordOnTx(tx, madrasaId, existing.id);
        existing = await this.repository.findByIdForTenantOnTx(tx, existing.id, madrasaId);
      }

      const data = makeStudentData(body, madrasaId) as Record<string, any>;

      // Auto-derived, never a manual client input (see AdmissionType doc-comment
      // on the Prisma model): a matching NID lookup means this is a returning
      // student being re-admitted, not a brand new one.
      data.admissionType = existing ? "RE_ADMISSION" : "NEW";
      if (forcePending) {
        // Public/online submissions always land as PENDING regardless of
        // whether they match an existing (already-approved) student, so a
        // Muhtamim reviews every public application before it takes effect.
        data.admissionStatus = "PENDING";
      }

      if (
        existing &&
        existing.classId === classId &&
        existing.academicYear === academicYear &&
        existing.roll
      ) {
        // Re-submitting the same class/session must not unnecessarily change
        // the student's existing roll.
        data.roll = existing.roll;
      } else {
        await this.repository.lockRollScopeOnTx(tx, madrasaId, classId, academicYear);
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
          registrationNo: existing.registrationNo!,
        };
      }

      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
      const nextRegistrationNo =
        (await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId)) + 1;
      const created = await this.repository.createOnTx(tx, {
        ...data,
        registrationNo: nextRegistrationNo,
      } as Prisma.StudentUncheckedCreateInput);

      return {
        studentId: created.id,
        action: "created" as const,
        roll: data.roll!,
        registrationNo: created.registrationNo!,
      };
    });

    // A PENDING admission isn't a real enrolled student yet - guardian
    // provisioning happens in approveAdmission() once a Muhtamim approves it.
    if (forcePending) {
      return result;
    }

    // Outside the transaction (and its lock ordering) - a direct admin
    // admission is always APPROVED (see makeStudentData), so the guardian
    // account is provisioned right away.
    await guardianService.ensureGuardianForStudent(
      madrasaId,
      result.studentId,
      body.guardian_phone,
      body.father_name || body.mother_name,
    );

    return result;
  }

  async admitStudentsBulk(
    students: StudentAdmissionRequestDto[],
    madrasaId: number | undefined,
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

      assertRollIsServerManaged(student, `Row ${index + 1}`);

      const classId = toNumber(student.class_id);
      if (!classId) throw new BadRequestError(`Row ${index + 1}: class_id is required`);

      return {
        student,
        classId,
        academicYear: String(student.academic_year || new Date().getFullYear()),
      };
    });

    const result = await this.repository.runTransaction(async (tx) => {
      // Use one consistent lock order across all student write flows:
      // identity -> student record -> roll scope -> registration scope.
      // Stable sorting prevents deadlocks between concurrent bulk requests.
      const uniqueNids = [
        ...new Set(
          prepared
            .map((row) => clean(row.student.nid) as string | null)
            .filter((nid): nid is string => Boolean(nid)),
        ),
      ].sort();

      for (const nid of uniqueNids) {
        await this.repository.lockStudentIdentityOnTx(tx, madrasaId, nid);
      }

      const existingByNid = new Map<string, any>();
      for (const nid of uniqueNids) {
        existingByNid.set(nid, await this.repository.findByNidOnTx(tx, madrasaId, nid));
      }

      const existingIds = [
        ...new Set(
          [...existingByNid.values()].filter(Boolean).map((student) => Number(student.id)),
        ),
      ].sort((a, b) => a - b);

      for (const studentId of existingIds) {
        await this.repository.lockStudentRecordOnTx(tx, madrasaId, studentId);
      }

      // Refresh after record locks in case a profile update completed between
      // the initial identity lookup and acquiring the record lock.
      for (const nid of uniqueNids) {
        existingByNid.set(nid, await this.repository.findByNidOnTx(tx, madrasaId, nid));
      }

      const rollScopes = [
        ...new Map(
          prepared.map((row) => [
            `${row.classId}:${row.academicYear}`,
            { classId: row.classId, academicYear: row.academicYear },
          ]),
        ).values(),
      ].sort((a, b) => a.classId - b.classId || a.academicYear.localeCompare(b.academicYear));

      for (const scope of rollScopes) {
        await this.repository.lockRollScopeOnTx(tx, madrasaId, scope.classId, scope.academicYear);
      }
      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);

      let inserted = 0;
      let updated = 0;
      const preview: BulkAdmissionRow[] = [];
      let nextRegistrationNo = await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId);
      const rollCounters = new Map<string, number>();

      for (let index = 0; index < prepared.length; index++) {
        const { student, classId, academicYear } = prepared[index];
        const nid = clean(student.nid) as string | null;
        const existing = nid ? existingByNid.get(nid) || null : null;
        const data = makeStudentData(student, madrasaId) as Record<string, any>;
        data.admissionType = existing ? "RE_ADMISSION" : "NEW";

        if (
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
            registrationNo: existing.registrationNo!,
            changes,
          });

          if (nid) {
            existingByNid.set(nid, { ...existing, ...updateData });
          }
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
            registrationNo: created.registrationNo!,
            changes: [],
          });

          if (nid) {
            existingByNid.set(nid, created);
          }
        }
      }

      return { inserted, updated, preview };
    });

    // Outside the transaction, same reasoning as admitStudent(). One
    // guardian-provisioning failure must not affect (or roll back) the
    // student rows this bulk admission already committed - log and continue.
    for (const row of result.preview) {
      const source = students[row.row - 1];
      if (!source) continue;
      await guardianService.ensureGuardianForStudent(
        madrasaId,
        row.id,
        source.guardian_phone,
        source.father_name || source.mother_name,
      );
    }

    return result;
  }

  /**
   * Bulk-update existing students via an Excel round-trip (export -> edit ->
   * re-upload). Unlike admitStudentsBulk this is per-row partial success, not
   * all-or-nothing: every field written is pre-validated in JS before any
   * Prisma call (a real Postgres error mid-$transaction would poison every
   * statement after it), so one bad row never rolls back the good ones.
   * class_id/division_id/academic_year/roll are structurally locked out via
   * STUDENT_BULK_UPDATE_FIELD_MAP - changing those must go through Promotion.
   */
  async updateStudentsBulk(
    rows: StudentBulkUpdateRowDto[],
    madrasaId: number | undefined,
  ): Promise<BulkUpdateResult> {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError("Students array is required");
    }

    if (!rows.some((r) => toNumber(r.id) !== null)) {
      throw new BadRequestError(
        "id কলাম পাওয়া যায়নি বা সব সারি খালি — সঠিক এক্সপোর্ট করা ফাইল আপলোড করুন",
      );
    }

    type PreparedRow = {
      row: number;
      id: number | null;
      data: Record<string, any>;
      notes: string[];
      skipReason: string | null;
    };

    const prepared: PreparedRow[] = rows.map((row, index) => {
      const rowNumber = index + 1;
      const id = toNumber(row.id);
      const notes: string[] = [];

      if (!id) {
        return { row: rowNumber, id: null, data: {}, notes, skipReason: "id নেই বা সঠিক নয়" };
      }

      const data: Record<string, any> = {};
      for (const key of Object.keys(STUDENT_BULK_UPDATE_FIELD_MAP)) {
        const field = STUDENT_BULK_UPDATE_FIELD_MAP[key];
        const value = (row as Record<string, unknown>)[key];

        if (key === "dob" || key === "admission_date") {
          const cleaned = clean(value);
          if (cleaned && !isValidDate(cleaned as string)) {
            notes.push(
              key === "dob"
                ? "জন্ম তারিখ সঠিক নয়, পরিবর্তন উপেক্ষা করা হয়েছে"
                : "ভর্তির তারিখ সঠিক নয়, পরিবর্তন উপেক্ষা করা হয়েছে",
            );
            continue; // keep the existing value untouched
          }
          data[field] = cleaned ? new Date(cleaned as string) : null;
        } else if (key === "gender") {
          data[field] = toGenderNumber(value);
        } else if (key === "previous_class_id") {
          const cleaned = clean(value);
          if (cleaned === null) {
            data[field] = null; // blank cell = intentional clear
          } else {
            const num = toNumber(cleaned);
            if (num === null) {
              notes.push("পূর্ববর্তী শ্রেণির আইডি সঠিক নয়, উপেক্ষা করা হয়েছে");
              continue;
            }
            data[field] = num; // existence re-checked against real class ids below
          }
        } else if (key === "age" || key === "residency_type" || key === "is_orphan") {
          data[field] = toNumber(value);
        } else {
          data[field] = clean(value);
        }
      }

      if (!data.nameBn || !String(data.nameBn).trim()) {
        return { row: rowNumber, id, data: {}, notes, skipReason: "নাম (name_bn) খালি রাখা যাবে না" };
      }

      return { row: rowNumber, id, data, notes, skipReason: null };
    });

    const result = await this.repository.runTransaction(async (tx) => {
      const validIds = [
        ...new Set(
          prepared.filter((r): r is PreparedRow & { id: number } => r.id !== null && !r.skipReason)
            .map((r) => r.id),
        ),
      ].sort((a, b) => a - b);

      for (const id of validIds) {
        await this.repository.lockStudentRecordOnTx(tx, madrasaId, id);
      }

      const existingRows = await this.repository.findManyByIdsForTenantOnTx(tx, validIds, madrasaId);
      const existingById = new Map(existingRows.map((s) => [s.id, s as Record<string, any>]));
      const validClassIds = await this.repository.findClassIdsForTenantOnTx(tx, madrasaId);

      let updated = 0;
      let unchanged = 0;
      let skipped = 0;
      const preview: BulkUpdateRow[] = [];

      for (const item of prepared) {
        const rawName = String((rows[item.row - 1] as Record<string, unknown>)?.name_bn ?? "");

        if (item.skipReason || item.id === null) {
          skipped++;
          preview.push({
            row: item.row,
            id: item.id ?? 0,
            name: rawName,
            status: "skipped",
            changes: [],
            notes: item.notes,
            error: item.skipReason ?? "id নেই বা সঠিক নয়",
          });
          continue;
        }

        const existing = existingById.get(item.id);
        if (!existing) {
          skipped++;
          preview.push({
            row: item.row,
            id: item.id,
            name: rawName,
            status: "skipped",
            changes: [],
            notes: item.notes,
            error: "এই আইডির শিক্ষার্থী পাওয়া যায়নি",
          });
          continue;
        }

        const notes = [...item.notes];
        const data = { ...item.data };

        if (
          "previousClassId" in data &&
          data.previousClassId != null &&
          !validClassIds.has(data.previousClassId)
        ) {
          delete data.previousClassId;
          notes.push("পূর্ববর্তী শ্রেণির আইডি সঠিক নয়, উপেক্ষা করা হয়েছে");
        }

        const source = rows[item.row - 1] as Record<string, unknown>;
        const lockedTamperKeys: Array<[string, string]> = [
          ["class_id", "classId"],
          ["division_id", "divisionId"],
          ["academic_year", "academicYear"],
          ["roll", "roll"],
        ];
        const tampered = lockedTamperKeys.some(([snakeKey, camelKey]) => {
          const raw = source[snakeKey];
          if (raw === undefined || raw === null || String(raw).trim() === "") return false;
          return String(raw) !== String(existing[camelKey] ?? "");
        });
        if (tampered) {
          notes.push(
            "ক্লাস/বিভাগ/সেশন/রোল পরিবর্তনের চেষ্টা উপেক্ষা করা হয়েছে — এর জন্য 'প্রমোশন' ফিচার ব্যবহার করুন",
          );
        }

        const changes = Object.entries(data)
          .map(([field, value]) => ({ field, old: existing[field], new: value }))
          .filter((change) => String(change.old ?? "") !== String(change.new ?? ""));

        if (!changes.length) {
          unchanged++;
          preview.push({
            row: item.row,
            id: item.id,
            name: existing.nameBn,
            status: "unchanged",
            changes: [],
            notes,
          });
          continue;
        }

        await this.repository.updateManyForTenantOnTx(tx, item.id, madrasaId, data);
        updated++;
        preview.push({
          row: item.row,
          id: item.id,
          name: data.nameBn ?? existing.nameBn,
          status: "updated",
          changes,
          notes,
        });
      }

      return { updated, unchanged, skipped, preview };
    });

    // Outside the transaction, same reasoning as admitStudentsBulk(): a
    // guardian-provisioning failure must not roll back already-committed
    // student rows - log and continue per row.
    for (const row of result.preview) {
      if (row.status === "skipped") continue;
      const source = rows[row.row - 1] as Record<string, unknown> | undefined;
      if (!source) continue;
      await guardianService.ensureGuardianForStudent(
        madrasaId,
        row.id,
        source.guardian_phone as string | undefined,
        (source.father_name as string | undefined) || (source.mother_name as string | undefined),
      );
    }

    return result;
  }

  async updateStudent(id: number, madrasaId: number | undefined, body: Record<string, any>) {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (body.dob && !isValidDate(body.dob)) {
      throw new BadRequestError("Invalid DOB");
    }

    assertRollIsServerManaged(body);

    const { count, guardianPhone, guardianFallbackName } = await this.repository.runTransaction(async (tx) => {
      await this.repository.lockStudentRecordOnTx(tx, madrasaId, id);
      const existing = await this.repository.findByIdForTenantOnTx(tx, id, madrasaId);
      if (!existing) throw new StudentNotFoundError();

      const data: Record<string, any> = {};
      for (const key of Object.keys(body)) {
        // Roll is immutable from the client and is assigned only when its scope changes.
        if (key === "roll" || key === "manual_roll_override") continue;

        const field = STUDENT_FIELD_MAP[key];
        if (!field) continue;

        if (key === "gender") {
          data[field] = toGenderNumber(body[key]);
        } else if (
          key === "age" ||
          key === "division_id" ||
          key === "class_id" ||
          key === "previous_class_id" ||
          key === "residency_type" ||
          key === "is_orphan"
        ) {
          data[field] = toNumber(body[key]);
        } else if (key === "dob" || key === "admission_date") {
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

      if (scopeChanged) {
        await this.repository.lockRollScopeOnTx(tx, madrasaId, targetClassId, targetAcademicYear);
        data.roll =
          (await this.repository.getMaxRollOnTx(tx, madrasaId, targetClassId, targetAcademicYear)) +
          1;
      }

      if (!Object.keys(data).length) {
        throw new BadRequestError("No valid data to update");
      }

      const result = await this.repository.updateManyForTenantOnTx(tx, id, madrasaId, data);
      return {
        count: result.count,
        // Resolve the *current* phone: this request's value if it touched
        // the field, otherwise whatever was already on file. That second
        // case is what backfills a guardian account for older students who
        // already had a phone number saved before this account-linking
        // existed, the first time anyone edits them.
        guardianPhone: ("guardianPhone" in data ? data.guardianPhone : existing.guardianPhone) as
          | string
          | null,
        guardianFallbackName: data.fatherName || data.motherName || existing.fatherName || existing.motherName,
      };
    });

    // Outside the transaction, same as admitStudent: guardian provisioning
    // does its own writes and shouldn't be nested in the student-row lock.
    // ensureGuardianForStudent no-ops safely when guardianPhone is empty.
    await guardianService.ensureGuardianForStudent(madrasaId, id, guardianPhone, guardianFallbackName);

    return count;
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

  /* ================= ADMISSION APPROVAL WORKFLOW ================= */

  /** Admission requests still waiting for admin review. */
  async listPendingAdmissions(madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();
    const rows = await this.repository.findPendingForTenant(madrasaId);
    return rows.map(toStudentApiDto);
  }

  /** Approves a pending admission. Roll/registration number were already
   * assigned at submission time by the existing admission flow, so approval
   * only flips the status and stamps who reviewed it. */
  async approveAdmission(id: number, madrasaId: number | undefined, reviewerId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const existing = await this.repository.findByIdForTenant(id, madrasaId);
    if (!existing) throw new StudentNotFoundError();
    if (existing.admissionStatus === "APPROVED") {
      throw new BadRequestError("This admission is already approved");
    }

    const result = await this.repository.updateManyForTenant(id, madrasaId, {
      admissionStatus: "APPROVED",
      reviewedBy: reviewerId ?? null,
      reviewedAt: new Date(),
      rejectionReason: null,
    });
    if (!result.count) throw new StudentNotFoundError();

    await guardianService.ensureGuardianForStudent(
      madrasaId,
      id,
      existing.guardianPhone,
      existing.fatherName || existing.motherName,
    );
  }

  /** Rejects a pending admission with a reason, keeping the record (rather
   * than deleting it) so the applicant/guardian can be told why. */
  async rejectAdmission(
    id: number,
    madrasaId: number | undefined,
    reviewerId: number | undefined,
    reason: string | undefined,
  ) {
    if (!madrasaId) throw new TenantNotResolvedError();
    if (!reason || !reason.trim()) throw new BadRequestError("Rejection reason is required");

    const existing = await this.repository.findByIdForTenant(id, madrasaId);
    if (!existing) throw new StudentNotFoundError();
    if (existing.admissionStatus === "REJECTED") {
      throw new BadRequestError("This admission is already rejected");
    }

    const result = await this.repository.updateManyForTenant(id, madrasaId, {
      admissionStatus: "REJECTED",
      reviewedBy: reviewerId ?? null,
      reviewedAt: new Date(),
      rejectionReason: reason.trim(),
    });
    if (!result.count) throw new StudentNotFoundError();
  }
}

export const studentService = new StudentService();
