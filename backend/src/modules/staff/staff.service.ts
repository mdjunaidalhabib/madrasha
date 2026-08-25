import { Prisma } from "@prisma/client";
import { staffRepository, StaffRepository } from "./staff.repository";
import { toNumber } from "../../shared/utils/parse.util";
import { BadRequestError, TenantNotResolvedError } from "../../shared/errors";
import { STAFF_FIELD_MAP, STAFF_DATE_FIELDS, STAFF_NUMBER_FIELDS } from "./staff.constants";
import { StaffNotFoundError } from "./staff.types";
import { StaffPayloadDto } from "./staff.dto";
import { toStaffApiDto } from "./staff.mapper";

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

const toGenderNumber = (value: unknown): 1 | 2 | null => {
  if (value === undefined || value === null || value === "") return null;
  if (value === 1 || value === "1" || String(value).toLowerCase() === "male") return 1;
  if (value === 2 || value === "2" || String(value).toLowerCase() === "female") return 2;
  return null;
};

const validateStaffPayload = (body: Record<string, any>): string | null => {
  if (!body.name_bn?.trim()) return "নাম বাধ্যতামূলক";
  return null;
};

const normalizeStaffPayload = (rawBody: Record<string, unknown>, madrasaId: number) => {
  const body = toSnakeCase(rawBody) as Record<string, any>;
  const dob = body.dob || null;

  const snakePayload: Record<string, any> = {
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

  const data: Record<string, any> = { madrasaId };
  for (const [snakeKey, value] of Object.entries(snakePayload)) {
    const field = STAFF_FIELD_MAP[snakeKey];
    if (!field) continue;
    data[field] = STAFF_DATE_FIELDS.has(snakeKey) && value ? new Date(value) : value;
  }

  return data;
};

export class StaffService {
  constructor(private readonly repository: StaffRepository = staffRepository) {}

  async listStaff(madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const rows = await this.repository.findMany(madrasaId);
    return rows.map(toStaffApiDto);
  }

  async getStaffDetail(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const row = await this.repository.findFirstForTenant(id, madrasaId);
    if (!row) throw new StaffNotFoundError();

    return toStaffApiDto(row as Record<string, any>);
  }

  async createStaff(rawBody: StaffPayloadDto, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const body = toSnakeCase(rawBody as Record<string, unknown>) as Record<string, any>;
    const validationError = validateStaffPayload(body);
    if (validationError) throw new BadRequestError(validationError);

    const data = normalizeStaffPayload(body, madrasaId);

    const created = await this.repository.runTransaction(async (tx) => {
      await this.repository.lockRegistrationScopeOnTx(tx, madrasaId);
      const nextRegistrationNo = (await this.repository.getMaxRegistrationNoOnTx(tx, madrasaId)) + 1;

      return this.repository.createOnTx(tx, {
        ...data,
        registrationNo: nextRegistrationNo,
      } as Prisma.StaffUncheckedCreateInput);
    });

    return created.id;
  }

  async updateStaff(id: number, madrasaId: number | undefined, rawBody: Record<string, any>) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const body = toSnakeCase(rawBody);
    const filtered: Record<string, any> = {};

    Object.keys(body).forEach((key) => {
      if ((body as any)[key] !== undefined) filtered[key] = (body as any)[key];
    });

    const fields = Object.keys(filtered).filter((key) => STAFF_FIELD_MAP[key]);
    if (!fields.length) {
      throw new BadRequestError("No data to update");
    }

    const data: Record<string, any> = {};
    for (const f of fields) {
      const val = filtered[f];
      let converted: any;

      if (f === "phone" || f === "parent_phone") converted = cleanPhone(val) || null;
      else if (f === "gender") converted = toGenderNumber(val);
      else if (STAFF_NUMBER_FIELDS.has(f)) converted = toNumber(val);
      else converted = val === "" ? null : val;

      if (STAFF_DATE_FIELDS.has(f) && converted) converted = new Date(converted);

      data[STAFF_FIELD_MAP[f]] = converted;
    }

    const result = await this.repository.updateManyForTenant(id, madrasaId, data);
    return result.count;
  }

  async deleteStaff(id: number, madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotResolvedError();

    const result = await this.repository.deleteManyForTenant(id, madrasaId);
    return result.count;
  }
}

export const staffService = new StaffService();
