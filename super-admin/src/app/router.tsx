import { lazy, Suspense, type JSX } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import SuperAdminLayout from "../layouts/SuperAdminLayout";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";
import SuperAdminLoginPage from "../features/super-admin/auth/SuperAdminLoginPage";

const SuperAdminDashboardPage = lazy(
  () => import("../features/super-admin/dashboard/SuperAdminDashboardPage"),
);
const SuperAdminMadrasasPage = lazy(
  () => import("../features/super-admin/madrasa-management/SuperAdminMadrasasPage"),
);
const SuperAdminMadrasasTrashPage = lazy(
  () => import("../features/super-admin/madrasa-management/SuperAdminMadrasasTrashPage"),
);
const SuperAdminMadrasaStaffPage = lazy(
  () => import("../features/super-admin/madrasa-management/SuperAdminMadrasaStaffPage"),
);
const SuperAdminPlansPage = lazy(
  () => import("../features/super-admin/subscriptions/SuperAdminPlansPage"),
);
const SuperAdminWebsiteControlPage = lazy(
  () => import("../features/super-admin/website-control/SuperAdminWebsiteControlPage"),
);
const SuperAdminDocumentTemplatesPage = lazy(
  () => import("../features/super-admin/document-templates/SuperAdminDocumentTemplatesPage"),
);
const SuperAdminDocumentTemplateEditorPage = lazy(
  () => import("../features/super-admin/document-templates/SuperAdminDocumentTemplateEditorPage"),
);
const SuperAdminSettingsPage = lazy(
  () => import("../features/super-admin/settings/SuperAdminSettingsPage"),
);
const SuperAdminCatalogPage = lazy(
  () => import("../features/super-admin/catalog/SuperAdminCatalogPage"),
);
const SuperAdminImportantLinksPage = lazy(
  () => import("../features/super-admin/important-links/SuperAdminImportantLinksPage"),
);
const SuperAdminVendorPromoPage = lazy(
  () => import("../features/super-admin/vendor-promo/SuperAdminVendorPromoPage"),
);
const SuperAdminDefaultFeeStructuresPage = lazy(
  () => import("../features/super-admin/fee/SuperAdminDefaultFeeStructuresPage"),
);
const SuperAdminSmsPackagesPage = lazy(
  () => import("../features/super-admin/billing/SuperAdminSmsPackagesPage"),
);
const SuperAdminEmailPackagesPage = lazy(
  () => import("../features/super-admin/billing/SuperAdminEmailPackagesPage"),
);
const SuperAdminBillingRequestsPage = lazy(
  () => import("../features/super-admin/billing/SuperAdminBillingRequestsPage"),
);
const SuperAdminBillingPricingPage = lazy(
  () => import("../features/super-admin/billing/SuperAdminBillingPricingPage"),
);
const SuperAdminBillingReportsPage = lazy(
  () => import("../features/super-admin/billing/SuperAdminBillingReportsPage"),
);

const NotFoundPage = lazy(() => import("../features/common/NotFoundPage"));

// Wraps a lazy-loaded page element in its own <Suspense> boundary so each
// route shows the lightweight PageLoader while its chunk downloads, without
// blocking or being blocked by any other route's chunk.
const withSuspense = (element: JSX.Element) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  { path: "/login", element: <SuperAdminLoginPage /> },
  {
    path: "/",
    element: <SuperAdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: withSuspense(<SuperAdminDashboardPage />) },
      { path: "madrasas", element: withSuspense(<SuperAdminMadrasasPage />) },
      { path: "madrasas/trash", element: withSuspense(<SuperAdminMadrasasTrashPage />) },
      { path: "madrasas/:id/staff", element: withSuspense(<SuperAdminMadrasaStaffPage />) },
      { path: "plans", element: withSuspense(<SuperAdminPlansPage />) },
      { path: "document-templates", element: withSuspense(<SuperAdminDocumentTemplatesPage />) },
      {
        path: "document-templates/:id/edit",
        element: withSuspense(<SuperAdminDocumentTemplateEditorPage />),
      },
      { path: "websites", element: withSuspense(<SuperAdminWebsiteControlPage />) },
      { path: "catalog", element: withSuspense(<SuperAdminCatalogPage />) },
      { path: "fee-structure-templates", element: withSuspense(<SuperAdminDefaultFeeStructuresPage />) },
      { path: "important-links", element: withSuspense(<SuperAdminImportantLinksPage />) },
      { path: "vendor-promo", element: withSuspense(<SuperAdminVendorPromoPage />) },
      { path: "billing/sms-packages", element: withSuspense(<SuperAdminSmsPackagesPage />) },
      { path: "billing/email-packages", element: withSuspense(<SuperAdminEmailPackagesPage />) },
      { path: "billing/requests", element: withSuspense(<SuperAdminBillingRequestsPage />) },
      { path: "billing/pricing", element: withSuspense(<SuperAdminBillingPricingPage />) },
      { path: "billing/reports", element: withSuspense(<SuperAdminBillingReportsPage />) },
      { path: "settings", element: withSuspense(<SuperAdminSettingsPage />) },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
]);
