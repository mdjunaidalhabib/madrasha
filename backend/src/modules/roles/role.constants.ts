import { ALWAYS_PROVISIONED_ROLE_KEYS } from "../super-admin/superadmin.constants";

/** Roles every madrasa is provisioned with (only MUHTAMIM). Permission
 * logic in shared/permissions/rbac-policy.ts short-circuits on MUHTAMIM,
 * so deleting it could silently break login/permission resolution - block
 * deletion regardless of user-count. TALIMAT/ACCOUNTANT are optional and
 * deletable like any custom role (the usual "no users assigned" rule still
 * applies).
 */
export const PROTECTED_ROLE_KEYS = ALWAYS_PROVISIONED_ROLE_KEYS;
