import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import GuardianLayout from "../layouts/GuardianLayout";
import GuardianAuthGuard from "../components/guards/GuardianAuthGuard";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";

const RootRoute = lazy(() => import("../features/landing/RootRoute"));
const CustomDomainTenantGate = lazy(() => import("../features/landing/CustomDomainTenantGate"));
const PublicWebsitePage = lazy(() => import("../features/website/PublicWebsitePage"));
const AdmissionApplyPage = lazy(() => import("../features/website/AdmissionApplyPage"));
const AttendanceKioskPage = lazy(() => import("../features/kiosk/AttendanceKioskPage"));

const GuardianLoginPage = lazy(() => import("../features/guardian/GuardianLoginPage"));
const GuardianChangePasswordPage = lazy(
  () => import("../features/guardian/GuardianChangePasswordPage"),
);
const GuardianDashboardPage = lazy(() => import("../features/guardian/GuardianDashboardPage"));
const GuardianAttendancePage = lazy(() => import("../features/guardian/GuardianAttendancePage"));
const GuardianResultsPage = lazy(() => import("../features/guardian/GuardianResultsPage"));
const GuardianFeesPage = lazy(() => import("../features/guardian/GuardianFeesPage"));
const MyChildProfile = lazy(() => import("../features/guardian/MyChildProfile"));
const GuardianNoticesPage = lazy(() => import("../features/guardian/GuardianNoticesPage"));

const NotFoundPage = lazy(() => import("../features/common/NotFoundPage"));

// Wraps a lazy-loaded page element in its own <Suspense> boundary so each
// route shows the lightweight PageLoader while its chunk downloads, without
// blocking or being blocked by any other route's chunk.
const withSuspense = (element: JSX.Element) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  { path: "/", element: withSuspense(<RootRoute />) },

  { path: "/m/:madrasaSlug", element: withSuspense(<PublicWebsitePage />) },
  { path: "/m/:madrasaSlug/admission", element: withSuspense(<AdmissionApplyPage />) },

  { path: "/:madrasaSlug/guardian/login", element: withSuspense(<GuardianLoginPage />) },
  {
    path: "/:madrasaSlug/guardian",
    element: (
      <GuardianAuthGuard>
        <GuardianLayout />
      </GuardianAuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: withSuspense(<GuardianDashboardPage />) },
      { path: "profile", element: withSuspense(<MyChildProfile />) },
      { path: "attendance", element: withSuspense(<GuardianAttendancePage />) },
      { path: "results", element: withSuspense(<GuardianResultsPage />) },
      { path: "fees", element: withSuspense(<GuardianFeesPage />) },
      { path: "notices", element: withSuspense(<GuardianNoticesPage />) },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
  {
    path: "/:madrasaSlug/guardian/change-password",
    element: withSuspense(<GuardianChangePasswordPage />),
  },

  { path: "/:madrasaSlug/admission", element: withSuspense(<AdmissionApplyPage />) },
  { path: "/:madrasaSlug/kiosk", element: withSuspense(<AttendanceKioskPage />) },

  // Bare (no-slug) equivalents of the routes above, reachable only on a
  // tenant's own connected custom domain - CustomDomainTenantGate resolves
  // which tenant owns the current hostname before any of these render (see
  // ARCHITECTURE.md "Custom domains"). Root "/" itself is handled by
  // RootRoute above since it needs different platform-vs-tenant behavior.
  // A literal "/admission" or "/kiosk" here always wins over "/:madrasaSlug"
  // below even though both are single-segment patterns - React Router ranks
  // matches by specificity (static segment > dynamic), not array order -
  // this is placed before it anyway just for readability.
  {
    element: withSuspense(<CustomDomainTenantGate />),
    children: [
      { path: "admission", element: withSuspense(<AdmissionApplyPage />) },
      { path: "guardian/login", element: withSuspense(<GuardianLoginPage />) },
      {
        path: "guardian",
        element: (
          <GuardianAuthGuard>
            <GuardianLayout />
          </GuardianAuthGuard>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: withSuspense(<GuardianDashboardPage />) },
          { path: "profile", element: withSuspense(<MyChildProfile />) },
          { path: "attendance", element: withSuspense(<GuardianAttendancePage />) },
          { path: "results", element: withSuspense(<GuardianResultsPage />) },
          { path: "fees", element: withSuspense(<GuardianFeesPage />) },
          { path: "notices", element: withSuspense(<GuardianNoticesPage />) },
          { path: "*", element: withSuspense(<NotFoundPage />) },
        ],
      },
      { path: "guardian/change-password", element: withSuspense(<GuardianChangePasswordPage />) },
      { path: "kiosk", element: withSuspense(<AttendanceKioskPage />) },
    ],
  },

  { path: "/:madrasaSlug", element: withSuspense(<PublicWebsitePage />) },

  { path: "*", element: withSuspense(<NotFoundPage />) },
]);
