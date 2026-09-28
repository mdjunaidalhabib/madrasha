import { BadRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";

/** This module's tenant-missing message differs from other modules' - preserved exactly. */
export class MadrasaNotFoundError extends BadRequestError {
  constructor() {
    super(t({ bn: "টেন্যান্টে প্রতিষ্ঠান পাওয়া যায়নি", en: "Institution not found in tenant" }));
  }
}

export class InvalidAssignmentRequestError extends BadRequestError {
  constructor() {
    super(t({ bn: "অনুরোধটি সঠিক নয়", en: "Invalid request" }));
  }
}

export class AssignmentAlreadyExistsError extends BadRequestError {
  constructor() {
    super(t({ bn: "এই শিক্ষকের ইতিমধ্যে দায়িত্ব নির্ধারিত আছে। পরিবর্তে আপডেট করুন।", en: "Teacher already has assignment. Use update instead." }));
  }
}

export interface GroupedAssignment {
  teacher_id: number;
  teacher_name: string | null;
  class_id: number;
  books: Array<{ book_id: number; book_name_bn: string | null }>;
}
