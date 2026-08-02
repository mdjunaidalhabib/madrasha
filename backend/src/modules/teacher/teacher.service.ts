import { Prisma } from "@prisma/client";
import { teacherRepository, TeacherRepository } from "./teacher.repository";
import { toNumber, clean, isValidDate } from "../../shared/utils/parse.util";
import { BadRequestError, TenantNotResolvedError } from "../../shared/errors";
import {
  TEACHER_FIELD_MAP,
  TEACHER_DATE_FIELDS,
  TEACHER_NUMBER_FIELDS,
  TEACHER_BULK_UPDATE_FIELD_MAP,
} from "./teacher.constants";
import {
  BulkTeacherResult,
  TeacherBulkUpdateResult,
  TeacherBulkUpdateRow,
  TeacherNotFoundError,
} from "./teacher.types";
import { TeacherPayloadDto, TeacherBulkUpdateRowDto } from "./teacher.dto";
import { toTeacherApiDto } from "./teacher.mapper";

const toSnakeCase = (obj: Record<string, unknown> = {}) => {
  const newObj: Record<string, unknown> = {};
  Object.keys(obj).forEach((key) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  });
  return newObj;
};

const cleanPhone = (phone: unknown) => String(phone || "").replace(/[^0-9]/g, "");

const calculateAge = (dob?: string | null) => {
  if (!dob) return null;

  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  return age;
};

/**
 * Accepts numeric 1/2 OR the string labels "male"/"female" - a superset of
 * shared/utils/parse.util's toGenderNumber, so kept local rather than
 * swapped for the shared one (which would reject the string-label case).
 */
const toGenderNumber = (value: unknown): 1 | 2 | null => {
  if (value === undefined || value === null || value === "") return null;
  if (value === 1 || value === "1" || String(value).toLowerCase() === "male") return 1;
  if (value === 2 || value === "2" || String(value).toLowerCase() === "female") return 2;
  return null;
};

const getDivisionId = (body: Record<string, any>) =>
  toNumber(body.academic_division ?? body.division_id ?? body.academicDivision);

const validateTeacherPayload = (body: Record<string, any>): string | null => {
  if (!body.name_bn?.trim()) return "নাম বাধ্যতামূলক";

  const divisionId = getDivisionId(body);
  if (!divisionId) return "একাডেমিক বিভাগ বাধ্যতামূলক";

  return null;
};

const normalizeTeacherPayload = (rawBody: Record<string, unknown>, madrasaId: number) => {
  const body = toSnakeCase(rawBody) as Record<string, any>;
  const divisionId = getDivisionId(body);
  const dob = body.dob || null;

  const snakePayload: Record<string, any> = {
    division_id: divisionId,

    name_bn: body.name_bn,
    name_ar: body.name_ar || null,
    nid: body.nid || null,
    gender: toGenderNumber(body.gender),
    dob,
    age: toNumber(body.age, calculateAge(dob)),

    phone: cleanPhone(body.phone) || null,
    email: body.email || null,

    designation: body.designation || null,
    department: body.department || null,
    qualification: body.qualification || null,

    experience_year: toNumber(body.experience_year, 0),
    experience_month: toNumber(body.experience_month, 0),

    joining_date: body.joining_date || null,
    salary: toNumber(body.salary),

    father_name: body.father_name || null,
    father_name_ar: body.father_name_ar || null,
    father_nid: body.father_nid || null,
    father_occupation: body.father_occupation || null,

    mother_name: body.mother_name || null,
    mother_nid: body.mother_nid || null,
    mother_occupation: body.mother_occupation || null,

    parent_phone: cleanPhone(body.parent_phone) || null,

    division: body.division || null,
    district: body.district || null,
    thana: body.thana || null,
    village: body.village || null,

    image: body.image || null,
  };

  // Translate to Prisma field names + typed data ready for prisma.teacher.create/update
  const data: Record<string, any> = { madrasaId };
  for (const [snakeKey, value] of Object.entries(snakePayload)) {
    const field = TEACHER_FIELD_MAP[snakeKey];
    if (!field) continue;
    data[field] = TEACHER_DATE_FIELDS.has(snakeKey) && value ? new Date(value) : value;
  }

  return data;
};

export class TeacherService {
  constructor(private readonly repository: TeacherRepository = teacherRepository) {}

  async listTeachers(madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const rows = await this.repository.findMany(madrasaId);
    return rows.map(toTeacherApiDto);
  }

  async getTeacherDetail(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const row = await this.repository.findFirstForTenant(id, madrasaId);
    if (!row) throw new TeacherNotFoundError();

    return toTeacherApiDto(row as Record<string, any>);
  }

  async createTeacher(rawBody: TeacherPayloadDto, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const body = toSnakeCase(rawBody as Record<string, unknown>) as Record<string, any>;
    const validationError = validateTeacherPayload(body);
    if (validationError) throw new BadRequestError(validationError);

    const data = normalizeTeacherPayload(body, madrasaId);

    const created = await this.repository.runTransaction(async (tx) => {
      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
      const nextRegistrationNo = (await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId)) + 1;

      return this.repository.createOnTx(tx, {
        ...data,
        registrationNo: nextRegistrationNo,
      } as Prisma.TeacherUncheckedCreateInput);
    });

    return created.id;
  }

  async bulkCreateTeachers(
    teachers: TeacherPayloadDto[],
    madrasaId: number | undefined,
  ): Promise<BulkTeacherResult> {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!Array.isArray(teachers) || !teachers.length) {
      throw new BadRequestError("Teacher list is empty");
    }

    return this.repository.runTransaction(async (tx) => {
      let inserted = 0;
      let updated = 0;
      const preview: BulkTeacherResult["preview"] = [];

      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
      let nextRegistrationNo = await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId);

      for (let i = 0; i < teachers.length; i++) {
        const body = toSnakeCase(teachers[i] as Record<string, unknown>) as Record<string, any>;
        const validationError = validateTeacherPayload(body);
        if (validationError) {
          throw new Error(`Row ${i + 2}: ${validationError}`);
        }

        const data = normalizeTeacherPayload(body, madrasaId);
        const nid = data.nid || null;
        let existing: any = null;
        if (nid) {
          existing = await this.repository.findByNidOnTx(tx, madrasaId, nid);
        }

        if (existing) {
          const { madrasaId: _omit, ...updateData } = data;
          const changes = Object.entries(updateData)
            .map(([field, value]) => ({ field, old: existing[field], new: value }))
            .filter((change) => String(change.old ?? "") !== String(change.new ?? ""));

          if (changes.length) {
            await this.repository.updateOnTx(tx, existing.id, updateData);
          }
          updated++;
          preview.push({ row: i + 2, action: "update", id: existing.id, nid, changes });
        } else {
          nextRegistrationNo += 1;
          const created = await this.repository.createOnTx(tx, {
            ...data,
            registrationNo: nextRegistrationNo,
          } as Prisma.TeacherUncheckedCreateInput);
          inserted++;
          preview.push({ row: i + 2, action: "create", id: created.id, nid, changes: [] });
        }
      }

      return { inserted, updated, preview };
    });
  }

  async updateTeacher(id: number, madrasaId: number | undefined, rawBody: Record<string, any>) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const body = toSnakeCase(rawBody);
    const filtered: Record<string, any> = {};

    Object.keys(body).forEach((key) => {
      if ((body as any)[key] !== undefined) filtered[key] = (body as any)[key];
    });

    if (filtered.academic_division !== undefined) {
      filtered.division_id = filtered.academic_division;
      delete filtered.academic_division;
    }

    if (filtered.division_id !== undefined && !toNumber(filtered.division_id)) {
      throw new BadRequestError("একাডেমিক বিভাগ বাধ্যতামূলক");
    }

    const fields = Object.keys(filtered).filter((key) => TEACHER_FIELD_MAP[key]);
    if (!fields.length) {
      throw new BadRequestError("No data to update");
    }

    const data: Record<string, any> = {};
    for (const f of fields) {
      const val = filtered[f];
      let converted: any;

      if (f === "phone" || f === "parent_phone") converted = cleanPhone(val) || null;
      else if (f === "gender") converted = toGenderNumber(val);
      else if (TEACHER_NUMBER_FIELDS.has(f)) converted = toNumber(val);
      else converted = val === "" ? null : val;

      if (TEACHER_DATE_FIELDS.has(f) && converted) converted = new Date(converted);

      data[TEACHER_FIELD_MAP[f]] = converted;
    }

    const result = await this.repository.updateManyForTenant(id, madrasaId, data);
    return result.count;
  }

  /**
   * Bulk-update existing teachers via an Excel round-trip (export -> edit ->
   * re-upload). Per-row partial success, not all-or-nothing: every field
   * written is pre-validated in JS before any Prisma call (a real Postgres
   * error mid-$transaction would poison every statement after it), so one
   * bad row never rolls back the good ones. Mirrors
   * student.service.ts's updateStudentsBulk. Unlike students, teachers have
   * no Promotion-equivalent audit-trailed workflow, so division_id stays
   * editable here (existence re-checked against the tenant's activated
   * divisions). email is uniqueness-checked (@@unique([madrasaId, email]))
   * both within the batch and against other existing teachers before any
   * write, for the same "never let a real DB error hit mid-transaction"
   * reason.
   */
  async updateTeachersBulk(
    rows: TeacherBulkUpdateRowDto[],
    madrasaId: number | undefined,
  ): Promise<TeacherBulkUpdateResult> {
    if (!madrasaId) throw new TenantNotResolvedError();

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError("Teacher list is required");
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
      for (const key of Object.keys(TEACHER_BULK_UPDATE_FIELD_MAP)) {
        const field = TEACHER_BULK_UPDATE_FIELD_MAP[key];
        const value = (row as Record<string, unknown>)[key];

        if (TEACHER_DATE_FIELDS.has(key)) {
          const cleaned = clean(value);
          if (cleaned && !isValidDate(cleaned as string)) {
            notes.push(
              key === "dob"
                ? "জন্ম তারিখ সঠিক নয়, পরিবর্তন উপেক্ষা করা হয়েছে"
                : "যোগদানের তারিখ সঠিক নয়, পরিবর্তন উপেক্ষা করা হয়েছে",
            );
            continue; // keep the existing value untouched
          }
          data[field] = cleaned ? new Date(cleaned as string) : null;
        } else if (key === "gender") {
          data[field] = toGenderNumber(value);
        } else if (key === "division_id") {
          // division_id is NOT NULL on Teacher - a blank cell can never mean
          // "clear it", only "leave unchanged".
          const cleaned = clean(value);
          if (cleaned === null) continue;
          const num = toNumber(cleaned);
          if (num === null) {
            notes.push("একাডেমিক বিভাগের আইডি সঠিক নয়, পরিবর্তন উপেক্ষা করা হয়েছে");
            continue;
          }
          data[field] = num; // existence re-checked against real division ids below
        } else if (key === "phone" || key === "parent_phone") {
          data[field] = cleanPhone(value) || null;
        } else if (TEACHER_NUMBER_FIELDS.has(key)) {
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

    // In-batch email de-duplication (no DB call needed): if the same new
    // email value appears on more than one row, applying either one first
    // would make the other's update() collide with @@unique([madrasaId,
    // email]) mid-transaction. Drop it from every row that shares it.
    const emailRowIndexes = new Map<string, number[]>();
    prepared.forEach((item, idx) => {
      if (item.skipReason || item.id === null || !item.data.email) return;
      const key = String(item.data.email).trim();
      if (!emailRowIndexes.has(key)) emailRowIndexes.set(key, []);
      emailRowIndexes.get(key)!.push(idx);
    });
    for (const indexes of emailRowIndexes.values()) {
      if (indexes.length <= 1) continue;
      for (const idx of indexes) {
        delete prepared[idx].data.email;
        prepared[idx].notes.push("এই ইমেইল একই ফাইলে একাধিক সারিতে ব্যবহৃত হয়েছে, উপেক্ষা করা হয়েছে");
      }
    }

    const result = await this.repository.runTransaction(async (tx) => {
      const validIds = [
        ...new Set(
          prepared.filter((r): r is PreparedRow & { id: number } => r.id !== null && !r.skipReason)
            .map((r) => r.id),
        ),
      ].sort((a, b) => a - b);

      for (const id of validIds) {
        await this.repository.lockTeacherRecordOnTx(tx, madrasaId, id);
      }

      const existingRows = await this.repository.findManyByIdsForTenantOnTx(tx, validIds, madrasaId);
      const existingById = new Map(existingRows.map((t) => [t.id, t as Record<string, any>]));
      const validDivisionIds = await this.repository.findDivisionIdsForTenantOnTx(tx, madrasaId);

      const candidateEmails = [
        ...new Set(
          prepared
            .filter((r) => r.id !== null && !r.skipReason && r.data.email)
            .map((r) => String(r.data.email)),
        ),
      ];
      const emailOwners = await this.repository.findTeachersByEmailsForTenantOnTx(
        tx,
        candidateEmails,
        madrasaId,
      );
      const ownerIdByEmail = new Map(emailOwners.map((t) => [String(t.email), t.id]));

      let updated = 0;
      let unchanged = 0;
      let skipped = 0;
      const preview: TeacherBulkUpdateRow[] = [];

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
            error: "এই আইডির শিক্ষক পাওয়া যায়নি",
          });
          continue;
        }

        const notes = [...item.notes];
        const data = { ...item.data };

        if (
          "divisionId" in data &&
          data.divisionId != null &&
          !validDivisionIds.has(data.divisionId)
        ) {
          delete data.divisionId;
          notes.push("একাডেমিক বিভাগের আইডি সঠিক নয়, পরিবর্তন উপেক্ষা করা হয়েছে");
        }

        if ("email" in data && data.email) {
          const ownerId = ownerIdByEmail.get(String(data.email));
          if (ownerId !== undefined && ownerId !== item.id) {
            delete data.email;
            notes.push("এই ইমেইল ইতিমধ্যে অন্য শিক্ষকের সাথে ব্যবহৃত হয়েছে, পরিবর্তন উপেক্ষা করা হয়েছে");
          }
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

    return result;
  }

  async deleteTeacher(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const result = await this.repository.deleteManyForTenant(id, madrasaId);
    return result.count;
  }
}

export const teacherService = new TeacherService();
