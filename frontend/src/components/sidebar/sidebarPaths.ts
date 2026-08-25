// Shared between Sidebar.tsx (nav links) and Breadcrumbs (page trail) so the
// route-path mapping for a sidebar module/child key only lives in one place.

import type { SidebarItem, SidebarChildItem } from "../../store/sidebarStore";

export const MODULE_PATHS: Record<string, string> = {
  reports: "reports",
  report: "reports",
  website: "settings/website",
  website_settings: "settings/website",
};

export const FEATURE_PATHS: Record<string, string> = {
  acadamic_report: "academic-report",
  academic_report: "academic-report",
  student_report: "student_report",
  exam_report: "exam_report",
  teacher_report: "teacher_report",
  pending_fee: "pending-fee",
};

// Some sidebar entries (moved here from plain action buttons on the ছাত্র
// তালিকা page) live at routes that don't match their menu's own module path
// (e.g. "promotion" sits under তালিমাত but its route is still students/promotion)
// — these need the full path, not module/childKey.
export const ABSOLUTE_CHILD_PATHS: Record<string, string> = {
  fee_management: "fee-management",
  fee_collection: "fee-collection",
  sessions: "students/sessions",
  routine: "routine",
  promotion: "students/promotion",
  attendance_mark: "attendance/mark",
  kiosk_devices: "attendance/kiosk-devices",
  attendance_report: "attendance/report",
  payroll: "payroll",
  single_send: "communication/single-send",
  bulk_send: "communication/bulk-send",
  history: "communication/history",
  auto_settings: "communication/auto-settings",
};

export function modulePath(key: string) {
  return MODULE_PATHS[key] || key;
}

export function childPath(moduleKey: string, childKey: string) {
  if (ABSOLUTE_CHILD_PATHS[childKey]) return ABSOLUTE_CHILD_PATHS[childKey];
  return `${modulePath(moduleKey)}/${FEATURE_PATHS[childKey] || childKey}`;
}

/**
 * Finds which sidebar module (and, if any, which of its children) the given
 * route subpath (pathname with the admin base already stripped) belongs to.
 *
 * Matching a route to "its" module by checking whether the subpath merely
 * starts with that module's own base path (`modulePath(module.key)`) breaks
 * for every child in ABSOLUTE_CHILD_PATHS above - e.g. "routine" belongs to
 * the তালিমাত module but lives at the top-level "/routine" path, so
 * "/routine".startsWith("talimat") is false even though তালিমাত is exactly
 * the module that should show as active. Checking each child's real,
 * resolved path (via childPath) instead of the module's own prefix is what
 * makes this correct for those remapped children too.
 */
export function matchSidebarPath(
  modules: SidebarItem[],
  subpath: string,
): { module: SidebarItem; child: SidebarChildItem | null } | null {
  for (const module of modules) {
    if (module.disabled) continue;

    if (!module.children || module.children.length === 0) {
      if (subpath === modulePath(module.key)) return { module, child: null };
      continue;
    }

    for (const child of module.children) {
      if (child.disabled) continue;
      const cPath = childPath(module.key, child.key);
      if (subpath === cPath || subpath.startsWith(`${cPath}/`)) {
        return { module, child };
      }
    }
  }

  return null;
}
