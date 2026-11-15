import { canPrefetch } from "@madrasha/shared-ui/src/utils/canPrefetch";

const loaders: Record<string, () => Promise<unknown>> = {
  dashboard: () =>
    import("../features/super-admin/dashboard/SuperAdminDashboardPage"),
  leads: () => import("../features/super-admin/leads/SuperAdminLeadsPage"),
  madrasas: () =>
    import("../features/super-admin/madrasa-management/SuperAdminMadrasasPage"),
  "madrasas/trash": () =>
    import("../features/super-admin/madrasa-management/SuperAdminMadrasasTrashPage"),
  plans: () =>
    import("../features/super-admin/subscriptions/SuperAdminPlansPage"),
  "document-templates": () =>
    import("../features/super-admin/document-templates/SuperAdminDocumentTemplatesPage"),
  websites: () =>
    import("../features/super-admin/website-control/SuperAdminWebsiteControlPage"),
  catalog: () =>
    import("../features/super-admin/catalog/SuperAdminCatalogPage"),
  "fee-structure-templates": () =>
    import("../features/super-admin/fee/SuperAdminDefaultFeeStructuresPage"),
  "important-links": () =>
    import("../features/super-admin/important-links/SuperAdminImportantLinksPage"),
  "vendor-promo": () =>
    import("../features/super-admin/vendor-promo/SuperAdminVendorPromoPage"),
  "billing/sms-packages": () =>
    import("../features/super-admin/billing/SuperAdminSmsPackagesPage"),
  "billing/email-packages": () =>
    import("../features/super-admin/billing/SuperAdminEmailPackagesPage"),
  "billing/requests": () =>
    import("../features/super-admin/billing/SuperAdminBillingRequestsPage"),
  "billing/pricing": () =>
    import("../features/super-admin/billing/SuperAdminBillingPricingPage"),
  "billing/reports": () =>
    import("../features/super-admin/billing/SuperAdminBillingReportsPage"),
  settings: () =>
    import("../features/super-admin/settings/SuperAdminSettingsPage"),
};
const loaded = new Set<string>();
export function prefetchSuperAdminRoute(path: string) {
  const key = path.replace(/^\/+|\/+$/g, "") || "dashboard";
  const load = loaders[key];
  if (!load || loaded.has(key) || !canPrefetch()) return;
  loaded.add(key);
  void load().catch(() => loaded.delete(key));
}
