import { NotFoundError } from "../../shared/errors";

export class TeacherNotFoundError extends NotFoundError {
  constructor() {
    super("Teacher not found");
  }
}

export interface BulkTeacherRow {
  row: number;
  action: "create" | "update";
  id: number;
  nid: string | null;
  changes: Array<{ field: string; old: unknown; new: unknown }>;
}

export interface BulkTeacherResult {
  inserted: number;
  updated: number;
  preview: BulkTeacherRow[];
}
