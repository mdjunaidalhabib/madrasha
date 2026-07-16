import { ApiError } from "./ApiError";
import { HttpStatus } from "../constants/http-status";

export class BadRequestError extends ApiError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, HttpStatus.BAD_REQUEST, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Conflict", details?: unknown) {
    super(message, HttpStatus.CONFLICT, details);
  }
}

export class GoneError extends ApiError {
  constructor(message = "Resource no longer available") {
    super(message, HttpStatus.GONE);
  }
}

export class LockedError extends ApiError {
  constructor(message = "Resource locked") {
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
    super("Tenant madrasa not found");
  }
}

/** Same check as TenantNotResolvedError, different wording used by several panel-style modules (classPanal, ExamPanel, ...). */
export class TenantNotFoundInRequestError extends BadRequestError {
  constructor() {
    super("Madrasa not found in tenant");
  }
}
