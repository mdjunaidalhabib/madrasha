import { ApiError } from "./ApiError";
import { HttpStatus } from "../constants/http-status";
import { t } from "../i18n";

export class BadRequestError extends ApiError {
  constructor(message: string = t({ bn: "অনুরোধটি সঠিক নয়", en: "Bad request" }), details?: unknown) {
    super(message, HttpStatus.BAD_REQUEST, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = t({ bn: "তথ্য যাচাই ব্যর্থ হয়েছে", en: "Validation failed" }), details?: unknown) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = t({ bn: "অনুমতি নেই", en: "Unauthorized" })) {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = t({ bn: "অনুমতি নেই", en: "Forbidden" })) {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = t({ bn: "তথ্য পাওয়া যায়নি", en: "Resource not found" })) {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = t({ bn: "তথ্যের সংঘর্ষ হয়েছে", en: "Conflict" }), details?: unknown) {
    super(message, HttpStatus.CONFLICT, details);
  }
}

export class GoneError extends ApiError {
  constructor(message: string = t({ bn: "তথ্যটি আর পাওয়া যাচ্ছে না", en: "Resource no longer available" })) {
    super(message, HttpStatus.GONE);
  }
}

export class LockedError extends ApiError {
  constructor(message: string = t({ bn: "তথ্যটি লক করা আছে", en: "Resource locked" })) {
    super(message, HttpStatus.LOCKED);
  }
}

/**
 * Every tenant-scoped module checks `req.tenant?.madrasa_id` and returns
 * this exact 400 if it's missing (in practice unreachable once
 * tenantMiddleware has run, but preserved as a defensive check). Extracted
 * here once several modules needed the identical error.
 */
export class TenantNotResolvedError extends BadRequestError {
  constructor() {
    super(t({ bn: "প্রতিষ্ঠান পাওয়া যায়নি", en: "Institution not found" }));
  }
}

/** Same check as TenantNotResolvedError, different wording used by several panel-style modules (classPanal, ExamPanel, ...). */
export class TenantNotFoundInRequestError extends BadRequestError {
  constructor() {
    super(t({ bn: "টেন্যান্টে প্রতিষ্ঠান পাওয়া যায়নি", en: "Institution not found in tenant" }));
  }
}
