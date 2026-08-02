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

export interface TeacherBulkUpdateRow {
  row: number;
  id: number;
  name: string;
  status: "updated" | "unchanged" | "skipped";
  changes: Array<{ field: string; old: unknown; new: unknown }>;
  notes: string[];
  error?: string;
}

export interface TeacherBulkUpdateResult {
  updated: number;
  unchanged: number;
  skipped: number;
  preview: TeacherBulkUpdateRow[];
}
