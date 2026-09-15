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
  "exam.schedule.read",
  "exam.schedule.manage",
  "exam.room.read",
  "exam.room.manage",
  "exam.invigilator.read",
  "exam.invigilator.manage",
  "exam.seat.read",
  "exam.seat.manage",
  "exam.attendance.read",
  "exam.attendance.manage",
  "result.read",
  "result.manage",
  // Marks/Result workflow keys, additive alongside the two legacy
  // result.read/result.manage keys above (see seed.ts's Permission catalog
  // for the matching rows and result-workflow/result-correction/
  // mark-component.routes.ts for where each is enforced).
  "marks.read",
  "marks.manage",
  "marks.submit",
  "marks.verify",
  "result.process",
  "result.verify",
  "result.approve",
  "result.publish",
  "result.lock",
  "result.correct",
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
