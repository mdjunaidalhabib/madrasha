import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";

export class InvalidMadrasaIdError extends BadRequestError {
  constructor() {
    super("Invalid madrasa id");
  }
}

export class MadrasaNotFoundError extends NotFoundError {
  constructor(message = "Madrasa not found") {
    super(message);
  }
}

export class InvalidWebsiteStatusError extends BadRequestError {
  constructor() {
    super("Invalid website status");
  }
}

export class PlanIdRequiredError extends BadRequestError {
  constructor() {
    super("plan_id required");
  }
}

export class InvalidPlanError extends BadRequestError {
  constructor(message = "Invalid plan") {
    super(message);
  }
}

export class TrashedMadrasaOperationError extends BadRequestError {
  constructor(message: string) {
    super(message);
  }
}

export class SlugConflictError extends ConflictError {
  constructor() {
    super(
      "Cannot restore: this slug is already used by another active madrasa. Rename that madrasa's slug first.",
    );
  }
}

export interface MadrasaListQuery {
  q?: string;
  page?: number | string;
  limit?: number | string;
}
