import { ForbiddenError } from "../../shared/errors";

export interface UserListItem {
  id: number;
  name: string;
  email: string;
  roleId: number;
  isActive: number;
  roleKey: string | null;
  isMuhtamim: boolean;
}

/** Every madrasa's default/owner (Muhtamim) account must always exist and
 * can never be removed through the tenant-facing staff management page. */
export class DefaultUserProtectedError extends ForbiddenError {
  constructor() {
    super("এটি মাদ্রাসার ডিফল্ট (মুহতামিম) অ্যাকাউন্ট, এটি ডিলিট করা যাবে না।");
  }
}
