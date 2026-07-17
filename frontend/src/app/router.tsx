import { lazy, Suspense, type JSX } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import AuthGuard from "../components/guards/AuthGuard";
import ModuleGuard from "../components/guards/ModuleGuard";
import SuperAdminLayout from "../layouts/SuperAdminLayout";
import PageLoader from "../components/ui/PageLoader";

// All page-level components are lazy-loaded so that a visitor to any one
// route (e.g. the public landing page at "/") only downloads the JS for
// that route, instead of the entire app (admin panel + super-admin panel +
// every feature module) up front. Without this, every visitor — even one
// who never logs in — had to wait for the whole bundle before anything
// rendered.
const LoginPage = lazy(() => import("../features/auth/LoginPage"));

const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const StudentListPage = lazy(() => import("../features/students/StudentListPage"));
const StudentProfilePage = lazy(() => import("../features/students/StudentProfilePage"));
const AdmissionPage = lazy(() => import("../features/students/AdmissionPage"));

const TeacherAdmissionPage = lazy(() => import("../features/teachers/TeacherPage"));
const TeacherListPage = lazy(() => import("../features/teachers/TeacherListPage"));
const TeacherProfilePage = lazy(() => import("../features/teachers/TeacherProfilePage"));

const AcademicReportPage = lazy(() => import("../features/reports/AcademicReportPage"));
const StudentReportPage = lazy(() => import("../features/reports/StudentReportPage"));
const TeacherReportPage = lazy(() => import("../features/reports/TeacherReportPage"));
const DocumentsReportPage = lazy(() => import("../features/reports/DocumentsReportPage"));

const ReportPage = lazy(() => import("../features/accounts/ReportPage"));
const IncomePage = lazy(() => import("../features/accounts/IncomePage"));
const ExpensePage = lazy(() => import("../features/accounts/ExpensePage"));

const TeacherAssignmentPanel = lazy(() => import("../features/talimat/TeacherAssignmentPanel"));
const ClassPanel = lazy(() => import("../features/talimat/ClassPanel"));
const ExamPanel = lazy(() => import("../features/talimat/ExamPanel"));
const ResultPreviewPage = lazy(() => import("../features/talimat/ResultPreviewPage"));
const ResultEntryPage = lazy(() => import("../features/talimat/ResultEntryPage"));
const TalimatDocumentsPage = lazy(() => import("../features/talimat/TalimatDocumentsPage"));

const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const AdminWebsiteSettingsPage = lazy(
  () => import("../features/admin/website-builder/AdminWebsiteSettingsPage"),
);
const BrandingSettingsPage = lazy(() => import("../features/admin/settings/BrandingSettingsPage"));
const SettingsPage = lazy(() => import("../features/admin/settings/SettingsPage"));

const SuperAdminLoginPage = lazy(() => import("../features/super-admin/auth/SuperAdminLoginPage"));
const SuperAdminDashboardPage = lazy(
  () => import("../features/super-admin/dashboard/SuperAdminDashboardPage"),
);
const SuperAdminMadrasasPage = lazy(
  () => import("../features/super-admin/madrasa-management/SuperAdminMadrasasPage"),
);
const SuperAdminMadrasasTrashPage = lazy(
  () => import("../features/super-admin/madrasa-management/SuperAdminMadrasasTrashPage"),
);
const SuperAdminPlansPage = lazy(
  () => import("../features/super-admin/subscriptions/SuperAdminPlansPage"),
);
const SuperAdminWebsiteControlPage = lazy(
  () => import("../features/super-admin/website-control/SuperAdminWebsiteControlPage"),
);

const PublicWebsitePage = lazy(() => import("../features/public/website/PublicWebsitePage"));
const QmsLandingPage = lazy(() => import("../features/public/landing/QmsLandingPage"));
const NotFoundPage = lazy(() => import("../features/common/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("../features/common/UnauthorizedPage"));

// Wraps a lazy-loaded page element in its own <Suspense> boundary so each
// route shows the lightweight PageLoader while its chunk downloads, without
// blocking or being blocked by any other route's chunk.
const withSuspense = (element: JSX.Element) => <Suspense fallback={<PageLoader />}>{element}</Suspense>;

const madrasaAdminChildren = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "unauthorized", element: withSuspense(<UnauthorizedPage />) },

  {
    path: "dashboard",
    element: (
      <ModuleGuard module="dashboard">{withSuspense(<DashboardPage />)}</ModuleGuard>
    ),
  },

  {
    path: "ihtemam/teacher_admission",
    element: (
      <ModuleGuard module="ihtemam">{withSuspense(<TeacherAdmissionPage />)}</ModuleGuard>
    ),
  },
  {
    path: "ihtemam/all_teacher",
    element: (
      <ModuleGuard module="ihtemam">{withSuspense(<TeacherListPage />)}</ModuleGuard>
    ),
  },
  {
    path: "ihtemam/:id",
    element: (
      <ModuleGuard module="ihtemam">{withSuspense(<TeacherProfilePage />)}</ModuleGuard>
    ),
  },

  {
    path: "reports/academic-report",
    element: (
      <ModuleGuard module="reports">{withSuspense(<AcademicReportPage />)}</ModuleGuard>
    ),
  },
  {
    path: "reports/student_report",
    element: (
      <ModuleGuard module="reports">{withSuspense(<StudentReportPage />)}</ModuleGuard>
    ),
  },
  {
    path: "reports/teacher_report",
    element: (
      <ModuleGuard module="reports">{withSuspense(<TeacherReportPage />)}</ModuleGuard>
    ),
  },
  {
    path: "reports/documents",
    element: (
      <ModuleGuard module="reports">{withSuspense(<DocumentsReportPage />)}</ModuleGuard>
    ),
  },

  {
    path: "talimat/class_panel",
    element: (
      <ModuleGuard module="talimat">{withSuspense(<ClassPanel />)}</ModuleGuard>
    ),
  },
  {
    path: "talimat/teacher_assignment",
    element: (
      <ModuleGuard module="talimat">{withSuspense(<TeacherAssignmentPanel />)}</ModuleGuard>
    ),
  },
  {
    path: "talimat/exam_panel",
    element: (
      <ModuleGuard module="talimat">{withSuspense(<ExamPanel />)}</ModuleGuard>
    ),
  },
  {
    path: "talimat/results",
    element: (
      <ModuleGuard module="talimat">{withSuspense(<ResultPreviewPage />)}</ModuleGuard>
    ),
  },
  {
    path: "talimat/results/entry",
    element: (
      <ModuleGuard module="talimat">{withSuspense(<ResultEntryPage />)}</ModuleGuard>
    ),
  },
  {
    path: "talimat/documents",
    element: (
      <ModuleGuard module="talimat">{withSuspense(<TalimatDocumentsPage />)}</ModuleGuard>
    ),
  },
  // NOTE: id_card / admit_card / certificate / testimonial / transfer_letter
  // used to be 5 separate routes that all rendered the exact same page.
  // They are now consolidated into the single "talimat/documents" route above
  // (with tabs inside the page for each document type). Old links redirect there.
  { path: "talimat/id_card", element: <Navigate to="../talimat/documents" replace /> },
  { path: "talimat/admit_card", element: <Navigate to="../talimat/documents" replace /> },
  { path: "talimat/certificate", element: <Navigate to="../talimat/documents" replace /> },
  { path: "talimat/testimonial", element: <Navigate to="../talimat/documents" replace /> },
  { path: "talimat/transfer_letter", element: <Navigate to="../talimat/documents" replace /> },

  {
    path: "students/new_admission",
    element: (
      <ModuleGuard module="students">{withSuspense(<AdmissionPage />)}</ModuleGuard>
    ),
  },
  {
    path: "students/list",
    element: (
      <ModuleGuard module="students">{withSuspense(<StudentListPage />)}</ModuleGuard>
    ),
  },
  {
    path: "students/:id",
    element: (
      <ModuleGuard module="students">{withSuspense(<StudentProfilePage />)}</ModuleGuard>
    ),
  },

  {
    path: "accounts/report",
    element: (
      <ModuleGuard module="accounts">{withSuspense(<ReportPage />)}</ModuleGuard>
    ),
  },
  {
    path: "accounts/income",
    element: (
      <ModuleGuard module="accounts">{withSuspense(<IncomePage />)}</ModuleGuard>
    ),
  },
  {
    path: "accounts/expense",
    element: (
      <ModuleGuard module="accounts">{withSuspense(<ExpensePage />)}</ModuleGuard>
    ),
  },

  {
    path: "website-settings",
    element: (
      <ModuleGuard module="website">{withSuspense(<AdminWebsiteSettingsPage />)}</ModuleGuard>
    ),
  },

  {
    path: "settings",
    element: (
      <ModuleGuard module="settings">{withSuspense(<SettingsPage />)}</ModuleGuard>
    ),
  },
  {
    path: "settings/branding",
    element: (
      <ModuleGuard module="settings">{withSuspense(<BrandingSettingsPage />)}</ModuleGuard>
    ),
  },

  {
    path: "activity",
    element: (
      <ModuleGuard module="activity">{withSuspense(<ActivityPage />)}</ModuleGuard>
    ),
  },

  { path: "*", element: withSuspense(<NotFoundPage />) },
];

export const router = createBrowserRouter([
  // QMS product landing page — shown at the root domain (e.g. https://qms.hikmahit.com)
  { path: "/", element: withSuspense(<QmsLandingPage />) },

  { path: "/super-admin/login", element: withSuspense(<SuperAdminLoginPage />) },
  {
    path: "/super-admin",
    element: <SuperAdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: withSuspense(<SuperAdminDashboardPage />) },
      { path: "madrasas", element: withSuspense(<SuperAdminMadrasasPage />) },
      { path: "madrasas/trash", element: withSuspense(<SuperAdminMadrasasTrashPage />) },
      { path: "plans", element: withSuspense(<SuperAdminPlansPage />) },
      { path: "websites", element: withSuspense(<SuperAdminWebsiteControlPage />) },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },

  {
    path: "/login",
    element: <Navigate to="/demo-madrasa/admin/login" replace />,
  },
  {
    path: "/admin/login",
    element: <Navigate to="/demo-madrasa/admin/login" replace />,
  },
  {
    path: "/admin/*",
    element: <Navigate to="/demo-madrasa/admin/dashboard" replace />,
  },

  { path: "/m/:madrasaSlug", element: withSuspense(<PublicWebsitePage />) },

  { path: "/:madrasaSlug/admin/login", element: withSuspense(<LoginPage />) },
  {
    path: "/:madrasaSlug/admin",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: madrasaAdminChildren,
  },

  { path: "/:madrasaSlug", element: withSuspense(<PublicWebsitePage />) },

  { path: "*", element: withSuspense(<NotFoundPage />) },
]);
