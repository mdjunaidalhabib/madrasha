import { BadRequestError } from "../../shared/errors";

/** This module's tenant-missing message differs from other modules' - preserved exactly. */
export class MadrasaNotFoundError extends BadRequestError {
  constructor() {
    super("Madrasa not found in tenant");
  }
}

export class InvalidAssignmentRequestError extends BadRequestError {
  constructor() {
    super("Invalid request");
  }
}

export class AssignmentAlreadyExistsError extends BadRequestError {
  constructor() {
    super("Teacher already has assignment. Use update instead.");
  }
}

export interface GroupedAssignment {
  teacher_id: number;
  teacher_name: string | null;
  class_id: number;
  books: Array<{ book_id: number; book_name_bn: string | null }>;
}
