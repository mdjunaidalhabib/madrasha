/**
 * Single source of truth for what the two built-in default roles (TALIMAT,
 * ACCOUNTANT — every madrasa gets these alongside MUHTAMIM at provisioning)
 * are granted out of the box. Seeded as real RolePermission rows both at
 * madrasa creation (superadmin.service.ts) and via the one-off backfill
 * script for already-provisioned madrasas, so both paths can never drift
 * apart from each other.
 */
export const TALIMAT_DEFAULT_PERMISSION_KEYS = [
  "talimat.manage",
  "students.read",
  "students.create",
  "students.update",
  "students.delete",
  "students.expel",
  "students.approve_admission",
  "students.promote",
  "students.session_read",
  "students.session_manage",
  "students.transfer_session",
  "teachers.read",
  "teachers.create",
  "teachers.update",
  "teachers.delete",
  "staff.read",
  "staff.create",
  "staff.update",
  "staff.delete",
  "attendance.read",
  "attendance.mark",
  "routine.read",
  "routine.manage",
  "exam.read",
  "exam.manage",
  "result.read",
  "result.manage",
  "notifications.read",
  "notifications.send",
  "notifications.settings",
  "document_templates.read",
  "document_templates.manage",
];

export const ACCOUNTANT_DEFAULT_PERMISSION_KEYS = [
  "accounts.read",
  "accounts.create",
  "accounts.update",
  "accounts.delete",
  "fee.read",
  "fee.manage",
  "fee.collect_payment",
  "payroll.read",
  "payroll.manage",
];

export const DEFAULT_ROLE_PERMISSION_KEYS: Record<string, string[]> = {
  TALIMAT: TALIMAT_DEFAULT_PERMISSION_KEYS,
  ACCOUNTANT: ACCOUNTANT_DEFAULT_PERMISSION_KEYS,
};
