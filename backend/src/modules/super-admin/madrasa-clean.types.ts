import { BadRequestError, ForbiddenError } from "../../shared/errors";

export class InvalidCleanModeError extends BadRequestError {
  constructor() {
    super("mode must be 'operational' or 'full'");
  }
}

export class CleanConfirmNameMismatchError extends BadRequestError {
  constructor() {
    super("মাদ্রাসার নাম সঠিকভাবে টাইপ করা হয়নি");
  }
}

export class CleanPasswordRequiredError extends BadRequestError {
  constructor() {
    super("পাসওয়ার্ড দিন");
  }
}

export class CleanPasswordIncorrectError extends ForbiddenError {
  constructor() {
    super("পাসওয়ার্ড সঠিক নয়");
  }
}
