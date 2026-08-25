import { normalizeAppRole } from "../../shared/permissions";
import { sidebarRepository, SidebarRepository } from "./sidebar.repository";
import { SidebarChildItem, SidebarModuleItem } from "./sidebar.types";
import {
  SIDEBAR_MUHTAMIM_ROLE,
  SIDEBAR_SUPER_ADMIN_ROLE,
  MODULE_PERMISSION_PREFIXES,
} from "./sidebar.constants";

const isModuleAllowed = (role: string, permissionKeys: string[], moduleKey: string) => {
  if (!role || role === SIDEBAR_MUHTAMIM_ROLE || role === SIDEBAR_SUPER_ADMIN_ROLE) return true;

  const prefixes = MODULE_PERMISSION_PREFIXES[moduleKey];
  if (prefixes === undefined) return true; // unknown module key - fail open, same as before
  if (prefixes.length === 0) return true; // e.g. dashboard - always visible

  return permissionKeys.some((key) => prefixes.some((prefix) => key === prefix || key.startsWith(prefix)));
};

export class SidebarService {
  constructor(private readonly repository: SidebarRepository = sidebarRepository) {}

  private async resolveRoleKey(roleId?: number): Promise<string> {
    if (!roleId) return "";
    const role = await this.repository.findRoleById(roleId);
    return normalizeAppRole(role?.keyName || role?.nameBn || "");
  }

  private async resolvePermissionKeys(roleId?: number): Promise<string[]> {
    if (!roleId) return [];
    const rows = await this.repository.findRolePermissionKeys(roleId);
    return rows.map((r) => r.permission.keyName).filter((k): k is string => Boolean(k));
  }

  async getSidebarTree(madrasaId: number, roleId?: number): Promise<SidebarModuleItem[]> {
    const [roleKey, permissionKeys] = await Promise.all([
      this.resolveRoleKey(roleId),
      this.resolvePermissionKeys(roleId),
    ]);

    const madrasaModules = await this.repository.findActiveMadrasaModules(madrasaId);
    // The old standalone `admission` module duplicated the "নতুন ভর্তি"
    // child inside ছাত্র বিভাগ and pointed to a non-existent top-level route.
    // Filter it here so existing databases stop showing it immediately, even
    // before the seed is run again.
    let modules = madrasaModules
      .map((mm) => mm.module)
      .filter((module) => module.keyName !== "admission");

    // "attendance" (উপস্থিতি - manual bulk-mark + the RFID/fingerprint gate
    // kiosk and its device management) used to be children ("attendance_mark",
    // "kiosk_devices") of the ছাত্র বিভাগ/শিক্ষার্থী module and is now its own
    // top-level module. Same reasoning/fallback as "communication" below -
    // surfaces it immediately for any tenant that already had students
    // active, even before the real MadrasaModule backfill/re-seed reaches it.
    if (
      !modules.some((module) => module.keyName === "attendance") &&
      modules.some((module) => module.keyName === "students")
    ) {
      modules.push({
        id: -9002,
        keyName: "attendance",
        nameBn: "উপস্থিতি",
        groupName: "core",
        sortOrder: 6.5,
      });
    }

    // "fee" (ফি ব্যবস্থাপনা) used to hold "ফি গ্রহণ" as a child of ছাত্র বিভাগ/
    // শিক্ষার্থী and "ভর্তি ফি পেন্ডিং" as a child of হিসাব বিভাগ, and is now
    // its own top-level module. Same reasoning/fallback as "attendance"/
    // "communication" below - surfaces it immediately for any tenant that
    // already had students active, even before the real MadrasaModule
    // backfill/re-seed reaches it.
    if (
      !modules.some((module) => module.keyName === "fee") &&
      modules.some((module) => module.keyName === "students")
    ) {
      modules.push({
        id: -9004,
        keyName: "fee",
        nameBn: "ফি ব্যবস্থাপনা",
        groupName: "core",
        sortOrder: 5.5,
      });
    }

    // "communication" (SMS/ইমেইল) used to be a child ("notifications") of the
    // ছাত্র বিভাগ/শিক্ষার্থী module and is now its own top-level module. Tenants
    // whose MadrasaModule rows were seeded before this split won't have an
    // active row for it yet, so surface it here (same reasoning as every other
    // fallback in this file) for any tenant that already had students active -
    // i.e. already had access to sending notifications before this change.
    if (
      !modules.some((module) => module.keyName === "communication") &&
      modules.some((module) => module.keyName === "students")
    ) {
      modules.push({
        id: -9001,
        keyName: "communication",
        nameBn: "SMS/ইমেইল",
        groupName: "core",
        sortOrder: 9.5,
      });
    }

    // "teacher_staff" (শিক্ষক স্টাফ) used to be two children
    // ("teacher_admission", "all_teacher") of ইহতিমাম and is now its own
    // top-level module, alongside the new স্টাফ admission/list pair. Same
    // reasoning as "attendance"/"communication" above - surfaces it
    // immediately for any tenant that already had ইহতিমাম active, even
    // before the real MadrasaModule row reaches it.
    if (
      !modules.some((module) => module.keyName === "teacher_staff") &&
      modules.some((module) => module.keyName === "ihtemam")
    ) {
      modules.push({
        id: -9003,
        keyName: "teacher_staff",
        nameBn: "শিক্ষক ও স্টাফ",
        groupName: "core",
        sortOrder: 8.5,
      });
    }

    // `website` now lives inside the Settings hub (সেটিংস > ওয়েবসাইট সেটিংস)
    // instead of its own top-level sidebar entry. Only fold it in when the
    // tenant actually has the `settings` module, so a tenant without it
    // (which shouldn't normally happen, but keeps this change non-breaking)
    // still gets a way to reach their website settings.
    const hasSettingsModule = modules.some((module) => module.keyName === "settings");
    if (hasSettingsModule) {
      modules = modules.filter((module) => module.keyName !== "website");
    }

    const moduleIds = modules.map((m) => m.id);
    const [features, pendingAdmissionsCount, pendingFeeStudentsCount] = await Promise.all([
      this.repository.findFeaturesByModuleIds(moduleIds),
      this.repository.countPendingAdmissions(madrasaId),
      this.repository.countPendingFeeStudents(madrasaId),
    ]);

    return modules.map((mod) => {
      const disabled = !isModuleAllowed(roleKey, permissionKeys, mod.keyName || "");
      const children: SidebarChildItem[] = features
        .filter((f) => f.moduleId === mod.id)
        // "ব্যালেন্স" was a tenant-facing gateway status check; balance/SMTP
        // status is now Super Admin-only (platform settings), so hide the
        // old seeded row for tenants who already have it in the DB.
        .filter((f) => !(mod.keyName === "communication" && f.keyName === "balance"))
        .map((f) => ({
          id: f.id,
          key: f.keyName,
          label: f.nameBn,
          sort_order: f.sortOrder,
          disabled,
        }));

      // Keep the newly introduced exam report visible in existing installations
      // even before the database seed is run again. Once seeded, the real row
      // is used and this fallback is skipped.
      if (mod.keyName === "reports" && !children.some((child) => child.key === "exam_report")) {
        children.push({
          id: -1003,
          key: "exam_report",
          label: "পরীক্ষা রিপোর্ট",
          sort_order: 2.5,
          disabled,
        });
      }

      // Same reasoning as exam_report above - surfaces the pending-admission
      // review page under ইহতিমাম in installations seeded before this
      // feature existed.
      if (mod.keyName === "ihtemam" && !children.some((child) => child.key === "pending")) {
        children.push({
          id: -1004,
          key: "pending",
          label: "পেন্ডিং ভর্তি অনুমোদন",
          sort_order: 3,
          disabled,
        });
      }

      // Badge the item with how many admissions are actually waiting, and
      // relabel it to "পেন্ডিং ভর্তি অনুমোদন" even for installs whose DB row
      // still has the old "পেন্ডিং" label from before students/pending_admission
      // was folded back into this one.
      if (mod.keyName === "ihtemam") {
        // "teacher_admission"/"all_teacher" moved out to the new
        // teacher_staff module - filter any already-seeded DB rows here so
        // existing installations stop showing them under ইহতিমাম
        // immediately, even before the real ModuleFeature move reaches them.
        for (const movedKey of ["teacher_admission", "all_teacher"]) {
          const idx = children.findIndex((child) => child.key === movedKey);
          if (idx !== -1) children.splice(idx, 1);
        }

        const pendingChild = children.find((child) => child.key === "pending");
        if (pendingChild) {
          pendingChild.label = "পেন্ডিং ভর্তি অনুমোদন";
          if (pendingAdmissionsCount > 0) pendingChild.count = pendingAdmissionsCount;
        }

        // "ফি সেটাপ" moved here from ছাত্র বিভাগ/শিক্ষার্থী - surfaces it
        // immediately in installations seeded before the move (same reasoning
        // as exam_report/pending above).
        if (!children.some((child) => child.key === "fee_management")) {
          children.push({
            id: -1005,
            key: "fee_management",
            label: "ফি সেটাপ",
            sort_order: 4,
            disabled,
          });
        }
      }

      // Same reasoning as ihtemam/attendance above - surfaces the moved
      // teacher_admission/all_teacher pair plus the new স্টাফ
      // admission/list pair under শিক্ষক স্টাফ in installations seeded
      // before this module split existed.
      if (mod.keyName === "teacher_staff") {
        const fallbackTeacherStaffChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "teacher_admission", label: "নতুন শিক্ষক", sortOrder: 1 },
          { key: "all_teacher", label: "শিক্ষকসমূহ", sortOrder: 2 },
          { key: "staff_admission", label: "নতুন স্টাফ", sortOrder: 3 },
          { key: "all_staff", label: "স্টাফসমূহ", sortOrder: 4 },
        ];
        for (const fallback of fallbackTeacherStaffChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(8000 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }
      }

      // Same reasoning as exam_report/pending above - surfaces ক্লাস/পরীক্ষার
      // রুটিন ও শিক্ষার্থী প্রমোশন under তালিমাত in installations seeded before
      // they moved here from ছাত্র বিভাগ.
      if (mod.keyName === "talimat") {
        // "class_panel", "exam_panel" and "documents" used to be direct
        // তালিমাত children, and "sessions" used to live here too. They're now
        // sub-pages reached through the single "সেটিং" hub below - filter any
        // already-seeded DB rows here so existing installations stop showing
        // them as separate entries immediately, even before the seed is run
        // again (same reasoning as the moved-key filters under "students"
        // below).
        for (const movedKey of ["class_panel", "exam_panel", "documents", "sessions"]) {
          const idx = children.findIndex((child) => child.key === movedKey);
          if (idx !== -1) children.splice(idx, 1);
        }

        const fallbackTalimatChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "routine", label: "ক্লাস/পরীক্ষার রুটিন", sortOrder: 6 },
          { key: "promotion", label: "শিক্ষার্থী প্রমোশন", sortOrder: 7 },
          { key: "settings", label: "সেটিং", sortOrder: 8 },
        ];
        for (const fallback of fallbackTalimatChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(3000 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }
      }

      // These used to be plain action buttons on the ছাত্র তালিকা page instead
      // of sidebar entries. Same reasoning as exam_report/pending above -
      // surface them immediately in installations seeded before this change.
      if (mod.keyName === "students") {
        // "ছাত্র বিভাগ" renamed to "শিক্ষার্থী" - relabel already-seeded DB
        // rows immediately, same reasoning as every other fallback here.
        mod.nameBn = "শিক্ষার্থী";

        // "হিসাব বিবরণী" duplicated "ফি গ্রহণ" (student invoice/payment/waive
        // view) and was removed. Filter any already-seeded DB row here so
        // existing installations stop showing it immediately, even before
        // the seed is run again.
        const statementIndex = children.findIndex((child) => child.key === "statement");
        if (statementIndex !== -1) children.splice(statementIndex, 1);

        // "sessions" (সেশন সেটাপ), "fee_management" (ফি সেটাপ), "fee_collection"
        // (ফি গ্রহণ, now its own "fee" module - see that block below),
        // "notifications" (SMS/ইমেইল), "attendance_mark" and "kiosk_devices"
        // (উপস্থিতি, now its own module - see the "attendance" block below)
        // moved out of this module entirely - filter any already-seeded DB
        // rows here so existing installations stop showing them immediately,
        // even before the seed is run again.
        for (const movedKey of [
          "sessions",
          "fee_management",
          "fee_collection",
          "notifications",
          "attendance_mark",
          "kiosk_devices",
        ]) {
          const idx = children.findIndex((child) => child.key === movedKey);
          if (idx !== -1) children.splice(idx, 1);
        }

        // The "list" (student list) child was renamed from "ছাত্রসমূহ" to
        // "শিক্ষার্থী সমূহ" - relabel the already-seeded row immediately.
        const listChild = children.find((child) => child.key === "list");
        if (listChild) listChild.label = "শিক্ষার্থী সমূহ";
      }

      // Everything attendance-related (manual bulk-mark + the RFID/fingerprint
      // gate kiosk and its device management) - see the moved-key filter
      // under "students" above. Same fallback reasoning as every other
      // block in this file: surfaces these immediately even for a tenant
      // whose "attendance" module row (real or synthesized above) has no
      // feature rows of its own yet.
      if (mod.keyName === "attendance") {
        const fallbackAttendanceChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "attendance_report", label: "উপস্থিতি রিপোর্ট", sortOrder: 1 },
          { key: "attendance_mark", label: "উপস্থিতি নিন", sortOrder: 2 },
          { key: "kiosk_devices", label: "কিওস্ক ডিভাইস", sortOrder: 3 },
        ];
        for (const fallback of fallbackAttendanceChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(7000 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }
      }

      // "ফি ব্যবস্থাপনা" - holds "ফি গ্রহণ" (moved from শিক্ষার্থী, stays purely
      // search-by-student) and "ভর্তি ফি পেন্ডিং" (moved from হিসাব বিভাগ -
      // separate from এহতেমাম > পেন্ডিং ভর্তি অনুমোদন, that's the approval
      // queue; this is just the unpaid admission-fee follow-up list). "ফি
      // সেটাপ" deliberately stays under ইহতিমাম. Same fallback reasoning as
      // every other block in this file: surfaces these immediately even for
      // a tenant whose "fee" module row (real or synthesized above) has no
      // feature rows of its own yet. Badged with how many students still owe.
      if (mod.keyName === "fee") {
        const fallbackFeeChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "fee_collection", label: "ফি গ্রহণ", sortOrder: 1 },
          { key: "pending_fee", label: "ভর্তি ফি পেন্ডিং", sortOrder: 2 },
        ];
        for (const fallback of fallbackFeeChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(9500 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }

        const pendingFeeChild = children.find((child) => child.key === "pending_fee");
        if (pendingFeeChild && pendingFeeStudentsCount > 0) {
          pendingFeeChild.count = pendingFeeStudentsCount;
        }
      }

      // Surfaces the new হিসাব ড্যাশবোর্ড (accounting-only dashboard) under
      // হিসাব in installations seeded before this feature existed.
      if (mod.keyName === "accounts" && !children.some((child) => child.key === "dashboard")) {
        children.push({
          id: -5006,
          key: "dashboard",
          label: "হিসাব ড্যাশবোর্ড",
          sort_order: 0,
          disabled,
        });
      }

      // Same reasoning as talimat/students above - surfaces শিক্ষক বেতন (পেরোল)
      // under হিসাব in installations seeded before this feature existed.
      if (mod.keyName === "accounts" && !children.some((child) => child.key === "payroll")) {
        children.push({
          id: -5004,
          key: "payroll",
          label: "শিক্ষক বেতন (পেরোল)",
          sort_order: 4,
          disabled,
        });
      }

      // Same reasoning as payroll above - surfaces সকল লেনদেন (the income/expense
      // list with edit & delete) under হিসাব in installations seeded before
      // this feature existed.
      if (mod.keyName === "accounts" && !children.some((child) => child.key === "transactions")) {
        children.push({
          id: -5005,
          key: "transactions",
          label: "সকল লেনদেন",
          sort_order: 5,
          disabled,
        });
      }

      // Surfaces the new ফান্ড ও খাত সেটিংস (income fund / expense group +
      // category CRUD) under হিসাব in installations seeded before this
      // feature existed.
      if (mod.keyName === "accounts" && !children.some((child) => child.key === "funds")) {
        children.push({
          id: -5007,
          key: "funds",
          label: "ফান্ড ও খাত সেটিংস",
          sort_order: 6,
          disabled,
        });
      }

      // Same reasoning as the module-level fallback above - a tenant whose
      // "communication" module row was only just synthesized (id -9001)
      // obviously has no real feature rows for it yet either.
      if (mod.keyName === "communication") {
        const fallbackCommunicationChildren: { key: string; label: string; sortOrder: number }[] =
          [
            { key: "single_send", label: "একক পাঠান", sortOrder: 1 },
            { key: "bulk_send", label: "বাল্ক পাঠান", sortOrder: 2 },
            { key: "history", label: "পাঠানোর ইতিহাস", sortOrder: 3 },
            { key: "auto_settings", label: "অটো নোটিফিকেশন", sortOrder: 4 },
          ];
        for (const fallback of fallbackCommunicationChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(6000 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }
      }

      // "settings" has no other real sidebar children in the DB yet - its
      // sub-pages only exist as cards on the settings hub page (see
      // SettingsPage.tsx). Same reasoning as reports/ihtemam/talimat/students
      // above - surface them directly as an expandable submenu (matching how
      // রিপোর্ট সমূহ already works) so jumping between settings pages doesn't
      // require going back through the hub page every time.
      if (mod.keyName === "settings") {
        const fallbackSettingsChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "profile", label: "প্রোফাইল সেটিংস", sortOrder: -1 },
          { key: "branding", label: "প্রতিষ্ঠান ব্র্যান্ডিং", sortOrder: -0.5 },
          { key: "website", label: "ওয়েবসাইট সেটিংস", sortOrder: 0 },
          { key: "payment-methods", label: "পেমেন্ট পদ্ধতি", sortOrder: 1 },
          { key: "users", label: "স্টাফ ব্যবস্থাপনা", sortOrder: 2 },
          { key: "roles", label: "রোল ও পারমিশন", sortOrder: 3 },
          { key: "plan", label: "প্ল্যান", sortOrder: 4 },
          { key: "trash", label: "ট্র্যাশ", sortOrder: 5 },
        ];
        for (const fallback of fallbackSettingsChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(4000 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }
      }

      children.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

      return {
        id: mod.id,
        key: mod.keyName,
        label: mod.nameBn,
        group: mod.groupName,
        sort_order: mod.sortOrder,
        disabled,
        children,
      };
    });
  }
}

export const sidebarService = new SidebarService();
