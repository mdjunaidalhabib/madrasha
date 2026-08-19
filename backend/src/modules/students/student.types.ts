import { ApiError, NotFoundError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";

export { TenantNotResolvedError } from "../../shared/errors";

export interface StudentListFilters {
  classId?: number;
  divisionId?: number;
  academicYear?: string;
  sessionId?: number;
}

/**
 * API-facing (snake_case) shape for a student row. This is the contract the
 * frontend (StudentListPage, StudentProfilePage, admission lookup) is
 * written against - it must match `student.controller`/`student.dto`
 * naming, NOT the camelCase Prisma model field names.
 */
export interface StudentApiDto {
  id: number;
  registration_no: number | null;
  name_bn: string;
  arabic_name: string | null;
  nid: string | null;
  gender: number | null;
  dob: Date | null;
  age: number | null;
  blood_group: string | null;
  residency_type: number | null;
  is_orphan: number | null;
  roll: number | null;
  division_id: number | null;
  class_id: number | null;
  academic_year: string;
  session_id: number | null;
  previous_class_id: number | null;
  previous_institution: string | null;
  previous_result: string | null;
  admission_date: Date | null;
  current_class: string | null;
  father_name: string | null;
  father_arabic_name: string | null;
  father_nid: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_nid: string | null;
  mother_occupation: string | null;
  guardian_phone: string | null;
  guardian_phone_2: string | null;
  alt_guardian_name: string | null;
  alt_guardian_relation: string | null;
  alt_guardian_address: string | null;
  alt_guardian_phone: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  village: string | null;
  image: string | null;
  /** RFID/NFC card UID assigned for kiosk attendance scanning, if any. */
  card_uid: string | null;
  admission_status: "PENDING" | "APPROVED" | "REJECTED";
  admission_type: "NEW" | "RE_ADMISSION";
  rejection_reason: string | null;
  /** 1 = সক্রিয় (active), 0 = বহিষ্কৃত (expelled). */
  is_active: number;
}

export type StudentListItem = StudentApiDto;

/** Result of a single admission submit - tells the caller whether a brand
 * new student was created, or a returning student (matched by NID) was
 * re-admitted into a new academic year (session) on their existing record. */
export interface AdmissionResult {
  studentId: number;
  action: "created" | "re_admitted";
  previousAcademicYear?: string;
  roll: number;
  registrationNo: number;
  /** Every admission now lands PENDING and waits on Muhtamim approval -
   * always "PENDING" today, but returned explicitly so callers don't have
   * to hardcode that assumption. */
  admissionStatus: "PENDING";
  /** The class's default fees, billed immediately at submission time (see
   * admitStudent) - surfaced so the admin-panel form can offer to collect
   * payment right away, and the public site can show what's due. */
  invoices: Array<{
    id: number;
    title: string;
    amount: number;
    paidAmount: number;
    waivedAmount: number;
    status: string;
  }>;
}

/** Shape returned to the frontend when it looks up a student by NID before
 * submitting the admission form, so it can offer a "found previous student -
 * update session?" flow instead of blindly creating a duplicate. */
export type PreviousStudentLookup = StudentApiDto;

export interface BulkAdmissionRow {
  row: number;
  action: "create" | "update";
  id: number;
  nid: string | null;
  name: string;
  previousAcademicYear: string | null;
  academicYear: string;
  roll: number;
  registrationNo: number;
  changes: Array<{ field: string; old: unknown; new: unknown }>;
}

export interface BulkAdmissionResult {
  inserted: number;
  updated: number;
  preview: BulkAdmissionRow[];
}

export interface BulkUpdateRow {
  row: number;
  id: number;
  name: string;
  status: "updated" | "unchanged" | "skipped";
  changes: Array<{ field: string; old: unknown; new: unknown }>;
  notes: string[];
  error?: string;
}

export interface BulkUpdateResult {
  updated: number;
  unchanged: number;
  skipped: number;
  preview: BulkUpdateRow[];
}

export class StudentNotFoundError extends NotFoundError {
  constructor() {
    super("Student not found");
  }
}

/** Carries the extra `missing_fields` / `received` fields the existing contract returns alongside `message`. */
export class MissingFieldsError extends ApiError {
  public readonly missingFields: string[];
  public readonly received: unknown;

  constructor(missingFields: string[], received: unknown) {
    super("Required fields missing", HttpStatus.BAD_REQUEST);
    this.missingFields = missingFields;
    this.received = received;
  }
}
