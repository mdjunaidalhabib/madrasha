import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";

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

export class CustomDomainConflictError extends ConflictError {
  constructor() {
    super("This domain is already connected to another madrasa.");
  }
}

export class InvalidCustomDomainError extends BadRequestError {
  constructor() {
    super("Invalid domain - enter a bare hostname like www.example.com");
  }
}

export class UserLimitReachedError extends BadRequestError {
  constructor() {
    super("User limit reached. Upgrade the plan or increase the user limit.");
  }
}

export class UserEmailConflictError extends ConflictError {
  constructor() {
    super("This email is already used by another user in this madrasa.");
  }
}

export class InvalidRoleError extends BadRequestError {
  constructor() {
    super("Invalid role_id for this madrasa");
  }
}

export class UserNameRequiredError extends BadRequestError {
  constructor() {
    super("User name required");
  }
}

export class UserEmailRequiredError extends BadRequestError {
  constructor() {
    super("User email required");
  }
}

export class UserPasswordTooShortError extends BadRequestError {
  constructor() {
    super("Password must be at least 6 characters");
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor() {
    super("User not found");
  }
}

export class DefaultUserProtectedError extends ForbiddenError {
  constructor() {
    super("This is the madrasa's default (Muhtamim) user and cannot be deleted.");
  }
}

export class MuhtamimRoleImmutableError extends ForbiddenError {
  constructor() {
    super("মুহতামিমের রোল পরিবর্তন করা যাবে না - প্রতিটি মাদ্রাসায় ঠিক একজন মুহতামিম থাকা আবশ্যক।");
  }
}

export class MuhtamimAlreadyExistsError extends ConflictError {
  constructor() {
    super("এই মাদ্রাসায় ইতিমধ্যে একজন মুহতামিম আছেন - দ্বিতীয় মুহতামিম তৈরি করা যাবে না।");
  }
}

export interface MadrasaListQuery {
  q?: string;
  page?: number | string;
  limit?: number | string;
}

/* ================= SUPER ADMIN ACCOUNTS ================= */

export class SuperAdminNameRequiredError extends BadRequestError {
  constructor() {
    super("Name required");
  }
}

export class SuperAdminEmailRequiredError extends BadRequestError {
  constructor() {
    super("Email required");
  }
}

export class SuperAdminPasswordTooShortError extends BadRequestError {
  constructor() {
    super("Password must be at least 6 characters");
  }
}

export class SuperAdminEmailConflictError extends ConflictError {
  constructor() {
    super("This email is already used by another super admin.");
  }
}

export class SuperAdminNotFoundError extends NotFoundError {
  constructor() {
    super("Super admin not found");
  }
}

export class CannotDeactivateSelfError extends ForbiddenError {
  constructor() {
    super("You cannot deactivate your own account.");
  }
}

export class LastActiveSuperAdminError extends ForbiddenError {
  constructor() {
    super("At least one active super admin must remain.");
  }
}
