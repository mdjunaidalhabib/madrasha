import { ForbiddenError } from "../../shared/errors";
import { t } from "../../shared/i18n";

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
    super(t({ bn: "এটি প্রতিষ্ঠানের ডিফল্ট (প্রধান) অ্যাকাউন্ট, এটি ডিলিট করা যাবে না।", en: "This is the institution's default (head) account and cannot be deleted.", ar: "هذا هو الحساب الافتراضي (الرئيس) للمؤسسة ولا يمكن حذفه." }));
  }
}
