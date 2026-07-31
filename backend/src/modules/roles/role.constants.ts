import { DEFAULT_MADRASA_ROLES } from "../super-admin/superadmin.constants";

/** The 3 roles every madrasa is provisioned with (see
 * DEFAULT_MADRASA_ROLES). Some permission logic in
 * shared/permissions/rbac-policy.ts has hardcoded fallback behavior tied
 * to these key names (MUHTAMIM/TALIMAT/ACCOUNTANT), so deleting one could
 * silently break login/permission resolution for anyone still assigned
 * to it - block deletion of these regardless of user-count.
 */
export const PROTECTED_ROLE_KEYS = DEFAULT_MADRASA_ROLES.map((r) => r.key);
