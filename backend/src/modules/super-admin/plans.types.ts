import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";

export class InvalidPlanIdError extends BadRequestError {
  constructor() {
    super("Invalid plan id");
  }
}

export class PlanNotFoundError extends NotFoundError {
  constructor(message: string) {
    super(message);
  }
}

export class PlanConflictError extends ConflictError {
  constructor(message: string) {
    super(message);
  }
}
