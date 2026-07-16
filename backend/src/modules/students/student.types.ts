import { ApiError, NotFoundError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";

export { TenantNotResolvedError } from "../../shared/errors";

export interface StudentListFilters {
  classId?: number;
  divisionId?: number;
  academicYear?: string;
}

export interface StudentListItem {
  id: number;
  nameBn: string;
  fatherName: string | null;
  guardianPhone: string | null;
  divisionId: number | null;
  classId: number | null;
  academicYear: string;
  previousClassId: number | null;
  gender: number | null;
  current_class: string | null;
}

export interface BulkAdmissionRow {
  row: number;
  action: "create" | "update";
  id: number;
  nid: string | null;
  changes: Array<{ field: string; old: unknown; new: unknown }>;
}

export interface BulkAdmissionResult {
  inserted: number;
  updated: number;
  preview: BulkAdmissionRow[];
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
