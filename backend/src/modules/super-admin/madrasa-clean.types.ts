import { BadRequestError, ForbiddenError } from "../../shared/errors";
import { t } from "../../shared/i18n";

export class InvalidCleanModeError extends BadRequestError {
  constructor() {
    super(t({ bn: "mode অবশ্যই 'operational' অথবা 'full' হতে হবে", en: "mode must be 'operational' or 'full'" }));
  }
}

export class CleanConfirmNameMismatchError extends BadRequestError {
  constructor() {
    super(t({ bn: "প্রতিষ্ঠানের নাম সঠিকভাবে টাইপ করা হয়নি", en: "The institution name was not typed correctly" }));
  }
}

export class CleanPasswordRequiredError extends BadRequestError {
  constructor() {
    super(t({ bn: "পাসওয়ার্ড দিন", en: "Enter the password" }));
  }
}

export class CleanPasswordIncorrectError extends ForbiddenError {
  constructor() {
    super(t({ bn: "পাসওয়ার্ড সঠিক নয়", en: "Incorrect password" }));
  }
}
