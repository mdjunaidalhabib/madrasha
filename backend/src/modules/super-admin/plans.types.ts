import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";

export class InvalidPlanIdError extends BadRequestError {
  constructor() {
    super(t({ bn: "প্ল্যান id সঠিক নয়", en: "Invalid plan id" }));
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
