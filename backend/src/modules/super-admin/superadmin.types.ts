import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";

export class InvalidMadrasaIdError extends BadRequestError {
  constructor() {
    super(t({ bn: "প্রতিষ্ঠানের id সঠিক নয়", en: "Invalid institution id" }));
  }
}

export class MadrasaNotFoundError extends NotFoundError {
  constructor(message = "Madrasa not found") {
    super(message);
  }
}

export class InvalidWebsiteStatusError extends BadRequestError {
  constructor() {
    super(t({ bn: "ওয়েবসাইটের অবস্থা সঠিক নয়", en: "Invalid website status" }));
  }
}

export class PlanIdRequiredError extends BadRequestError {
  constructor() {
    super(t({ bn: "plan_id আবশ্যক", en: "plan_id required" }));
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
      t({ bn: "পুনরুদ্ধার করা যাবে না: এই slug অন্য একটি সক্রিয় প্রতিষ্ঠান ব্যবহার করছে। আগে সেই প্রতিষ্ঠানের slug পরিবর্তন করুন।", en: "Cannot restore: this slug is already used by another active institution. Rename that institution's slug first." }),
    );
  }
}

export class CustomDomainConflictError extends ConflictError {
  constructor() {
    super(t({ bn: "এই ডোমেইন ইতিমধ্যে অন্য একটি প্রতিষ্ঠানের সাথে যুক্ত।", en: "This domain is already connected to another institution." }));
  }
}

export class InvalidCustomDomainError extends BadRequestError {
  constructor() {
    super(t({ bn: "ডোমেইন সঠিক নয় - www.example.com এর মতো শুধু হোস্টনেম দিন", en: "Invalid domain - enter a bare hostname like www.example.com" }));
  }
}

export class UserLimitReachedError extends BadRequestError {
  constructor() {
    super(t({ bn: "ব্যবহারকারীর সীমা পূর্ণ হয়েছে। প্ল্যান আপগ্রেড করুন বা ব্যবহারকারীর সীমা বাড়ান।", en: "User limit reached. Upgrade the plan or increase the user limit.", ar: "تم الوصول إلى الحد الأقصى للمستخدمين. قم بترقية الخطة أو زيادة حد المستخدمين." }));
  }
}

export class UserEmailConflictError extends ConflictError {
  constructor() {
    super(t({ bn: "এই ইমেইল এই প্রতিষ্ঠানের অন্য একজন ব্যবহারকারী ব্যবহার করছেন।", en: "This email is already used by another user in this institution.", ar: "هذا البريد الإلكتروني مستخدم بالفعل من قبل مستخدم آخر في هذه المؤسسة." }));
  }
}

export class InvalidRoleError extends BadRequestError {
  constructor() {
    super(t({ bn: "এই প্রতিষ্ঠানের জন্য role_id সঠিক নয়", en: "Invalid role_id for this institution", ar: "role_id غير صالح لهذه المؤسسة" }));
  }
}

export class UserNameRequiredError extends BadRequestError {
  constructor() {
    super(t({ bn: "ব্যবহারকারীর নাম আবশ্যক", en: "User name required" }));
  }
}

export class UserEmailRequiredError extends BadRequestError {
  constructor() {
    super(t({ bn: "ব্যবহারকারীর ইমেইল আবশ্যক", en: "User email required" }));
  }
}

export class UserPasswordTooShortError extends BadRequestError {
  constructor() {
    super(t({ bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", en: "Password must be at least 6 characters", ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل" }));
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor() {
    super(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found", ar: "لم يتم العثور على المستخدم" }));
  }
}

export class DefaultUserProtectedError extends ForbiddenError {
  constructor() {
    super(t({ bn: "এটি প্রতিষ্ঠানের ডিফল্ট (প্রধান) ব্যবহারকারী, মুছে ফেলা যাবে না।", en: "This is the institution's default (head) user and cannot be deleted." }));
  }
}

export class MuhtamimRoleImmutableError extends ForbiddenError {
  constructor() {
    super(t({ bn: "প্রতিষ্ঠান প্রধানের রোল পরিবর্তন করা যাবে না - প্রতিটি প্রতিষ্ঠানে ঠিক একজন প্রধান থাকা আবশ্যক।", en: "The institution head's role cannot be changed - every institution must have exactly one head." }));
  }
}

export class MuhtamimAlreadyExistsError extends ConflictError {
  constructor() {
    super(t({ bn: "এই প্রতিষ্ঠানে ইতিমধ্যে একজন প্রধান আছেন - দ্বিতীয় প্রধান তৈরি করা যাবে না।", en: "This institution already has a head - a second head cannot be created." }));
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
    super(t({ bn: "নাম আবশ্যক", en: "Name required" }));
  }
}

export class SuperAdminEmailRequiredError extends BadRequestError {
  constructor() {
    super(t({ bn: "ইমেইল আবশ্যক", en: "Email required" }));
  }
}

export class SuperAdminPasswordTooShortError extends BadRequestError {
  constructor() {
    super(t({ bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", en: "Password must be at least 6 characters", ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل" }));
  }
}

export class SuperAdminEmailConflictError extends ConflictError {
  constructor() {
    super(t({ bn: "এই ইমেইল অন্য একজন সুপার অ্যাডমিন ব্যবহার করছেন।", en: "This email is already used by another super admin." }));
  }
}

export class SuperAdminNotFoundError extends NotFoundError {
  constructor() {
    super(t({ bn: "সুপার অ্যাডমিন পাওয়া যায়নি", en: "Super admin not found" }));
  }
}

export class CannotDeactivateSelfError extends ForbiddenError {
  constructor() {
    super(t({ bn: "নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।", en: "You cannot deactivate your own account." }));
  }
}

export class LastActiveSuperAdminError extends ForbiddenError {
  constructor() {
    super(t({ bn: "অন্তত একজন সক্রিয় সুপার অ্যাডমিন থাকতে হবে।", en: "At least one active super admin must remain." }));
  }
}
