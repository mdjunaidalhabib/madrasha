import { normalizeAppRole } from "../../shared/permissions";
import { sidebarRepository, SidebarRepository } from "./sidebar.repository";
import { SidebarChildItem, SidebarModuleItem } from "./sidebar.types";
import {
  SIDEBAR_MUHTAMIM_ROLE,
  SIDEBAR_SUPER_ADMIN_ROLE,
  SIDEBAR_TALIMAT_ROLE,
  SIDEBAR_ACCOUNTANT_ROLE,
  SIDEBAR_TALIMAT_MODULE_KEY,
  SIDEBAR_ACCOUNTS_MODULE_KEY,
} from "./sidebar.constants";

const isAllowed = (role: string, moduleKey: string) => {
  if (!role || role === SIDEBAR_MUHTAMIM_ROLE || role === SIDEBAR_SUPER_ADMIN_ROLE) return true;
  if (role === SIDEBAR_TALIMAT_ROLE) return moduleKey === SIDEBAR_TALIMAT_MODULE_KEY;
  if (role === SIDEBAR_ACCOUNTANT_ROLE) return moduleKey === SIDEBAR_ACCOUNTS_MODULE_KEY;
  return true;
};

export class SidebarService {
  constructor(private readonly repository: SidebarRepository = sidebarRepository) {}

  private async resolveRoleKey(roleId?: number): Promise<string> {
    if (!roleId) return "";
    const role = await this.repository.findRoleById(roleId);
    return normalizeAppRole(role?.keyName || role?.nameBn || "");
  }

  async getSidebarTree(madrasaId: number, roleId?: number): Promise<SidebarModuleItem[]> {
    const roleKey = await this.resolveRoleKey(roleId);

    const madrasaModules = await this.repository.findActiveMadrasaModules(madrasaId);
    // The old standalone `admission` module duplicated the "নতুন ভর্তি"
    // child inside ছাত্র বিভাগ and pointed to a non-existent top-level route.
    // Filter it here so existing databases stop showing it immediately, even
    // before the seed is run again.
    let modules = madrasaModules
      .map((mm) => mm.module)
      .filter((module) => module.keyName !== "admission");

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
    const [features, pendingAdmissionsCount] = await Promise.all([
      this.repository.findFeaturesByModuleIds(moduleIds),
      this.repository.countPendingAdmissions(madrasaId),
    ]);

    return modules.map((mod) => {
      const disabled = !isAllowed(roleKey, mod.keyName || "");
      const children: SidebarChildItem[] = features
        .filter((f) => f.moduleId === mod.id)
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
        const pendingChild = children.find((child) => child.key === "pending");
        if (pendingChild) {
          pendingChild.label = "পেন্ডিং ভর্তি অনুমোদন";
          if (pendingAdmissionsCount > 0) pendingChild.count = pendingAdmissionsCount;
        }
      }

      // Same reasoning as exam_report/pending above - surfaces ক্লাস/পরীক্ষার
      // রুটিন ও শিক্ষার্থী প্রমোশন under তালিমাত in installations seeded before
      // they moved here from ছাত্র বিভাগ.
      if (mod.keyName === "talimat") {
        const fallbackTalimatChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "routine", label: "ক্লাস/পরীক্ষার রুটিন", sortOrder: 6 },
          { key: "promotion", label: "শিক্ষার্থী প্রমোশন", sortOrder: 7 },
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
        const fallbackStudentChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "sessions", label: "সেশন সেটাপ", sortOrder: 2 },
          { key: "statement", label: "হিসাব বিবরণী", sortOrder: 3 },
          { key: "fee_management", label: "ফি সেটাপ", sortOrder: 4 },
          { key: "fee_collection", label: "ফি গ্রহণ", sortOrder: 5 },
          { key: "notifications", label: "SMS/ইমেইল পাঠান", sortOrder: 6 },
          { key: "attendance_mark", label: "উপস্থিতি নিন", sortOrder: 7 },
        ];
        for (const fallback of fallbackStudentChildren) {
          if (!children.some((child) => child.key === fallback.key)) {
            children.push({
              id: -(2000 + fallback.sortOrder),
              key: fallback.key,
              label: fallback.label,
              sort_order: fallback.sortOrder,
              disabled,
            });
          }
        }

        // fee_management used to cover both "ফি কাঠামো" and payment
        // collection in one page/label. Now that fee_collection is its own
        // entry, relabel the already-seeded row so installs from before this
        // split stop showing the old "ফি ব্যবস্থাপনা" wording.
        const feeManagementChild = children.find((child) => child.key === "fee_management");
        if (feeManagementChild) feeManagementChild.label = "ফি সেটাপ";
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

      // "settings" has no other real sidebar children in the DB yet - its
      // sub-pages only exist as cards on the settings hub page (see
      // SettingsPage.tsx). Same reasoning as reports/ihtemam/talimat/students
      // above - surface them directly as an expandable submenu (matching how
      // রিপোর্ট সমূহ already works) so jumping between settings pages doesn't
      // require going back through the hub page every time.
      if (mod.keyName === "settings") {
        const fallbackSettingsChildren: { key: string; label: string; sortOrder: number }[] = [
          { key: "profile", label: "প্রোফাইল সেটিংস", sortOrder: -1 },
          { key: "website", label: "ওয়েবসাইট সেটিংস", sortOrder: 0 },
          { key: "branding", label: "রিপোর্ট ব্র্যান্ডিং", sortOrder: 1 },
          { key: "payment-methods", label: "পেমেন্ট পদ্ধতি", sortOrder: 2 },
          { key: "users", label: "স্টাফ ব্যবস্থাপনা", sortOrder: 3 },
          { key: "roles", label: "রোল ও পারমিশন", sortOrder: 4 },
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
