export const SIDEBAR_MUHTAMIM_ROLE = "MUHTAMIM";
export const SIDEBAR_SUPER_ADMIN_ROLE = "SUPER_ADMIN";

/**
 * Which permission-key prefixes unlock a given sidebar module for a
 * non-MUHTAMIM/non-SUPER_ADMIN role. A module is visible/enabled the moment
 * the user's granted permission keys contain at least one key that equals or
 * starts with one of its prefixes. An empty array means "always visible,
 * regardless of permissions" (e.g. the dashboard).
 *
 * This replaces the old hardcoded 4-role table, which only ever restricted
 * TALIMAT/ACCOUNTANT and let every custom role fall through to "see
 * everything" — the real fix is driving this off the user's actual granted
 * permissions (same RolePermission rows the backend route guards check),
 * so any custom role is correctly restricted too.
 */
export const MODULE_PERMISSION_PREFIXES: Record<string, string[]> = {
  dashboard: [],
  ihtemam: ["teachers.", "students.approve_admission", "fee."],
  reports: ["reports."],
  talimat: [
    "talimat.",
    "teachers.",
    "exam.",
    "result.",
    "routine.",
    "document_templates.",
    "students.session",
    "students.promote",
  ],
  accounts: ["accounts.", "fee.", "payroll."],
  students: ["students."],
  attendance: ["attendance.", "kiosk."],
  communication: ["notifications."],
  library: ["library."],
  settings: ["settings.", "roles.manage", "users.", "website.manage"],
  activity: ["activity."],
  website: ["website.manage"],
};
