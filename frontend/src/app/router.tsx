import { lazy, Suspense, type JSX } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import GuardianLayout from "../layouts/GuardianLayout";
import AuthGuard from "../components/guards/AuthGuard";
import GuardianAuthGuard from "../components/guards/GuardianAuthGuard";
import ModuleGuard from "../components/guards/ModuleGuard";
import SuperAdminLayout from "../layouts/SuperAdminLayout";
import PageLoader from "../components/ui/PageLoader";
import LoginPage from "../features/auth/LoginPage";
const ForgotPasswordPage = lazy(() => import("../features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../features/auth/ResetPasswordPage"));
import SuperAdminLoginPage from "../features/super-admin/auth/SuperAdminLoginPage";

const GuardianLoginPage = lazy(() => import("../features/guardian/GuardianLoginPage"));
const GuardianChangePasswordPage = lazy(
  () => import("../features/guardian/GuardianChangePasswordPage"),
);
const GuardianDashboardPage = lazy(() => import("../features/guardian/GuardianDashboardPage"));
const GuardianAttendancePage = lazy(() => import("../features/guardian/GuardianAttendancePage"));
const GuardianResultsPage = lazy(() => import("../features/guardian/GuardianResultsPage"));
const GuardianFeesPage = lazy(() => import("../features/guardian/GuardianFeesPage"));
const GuardianNoticesPage = lazy(() => import("../features/guardian/GuardianNoticesPage"));

// All page-level components are lazy-loaded so that a visitor to any one
// route (e.g. the public landing page at "/") only downloads the JS for
// that route, instead of the entire app (admin panel + super-admin panel +
// every feature module) up front. Without this, every visitor — even one
// who never logs in — had to wait for the whole bundle before anything
// rendered.
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const StudentListPage = lazy(() => import("../features/students/StudentListPage"));
const StudentProfilePage = lazy(() => import("../features/students/StudentProfilePage"));
const AdmissionPage = lazy(() => import("../features/students/AdmissionPage"));
const PendingAdmissionsPage = lazy(() => import("../features/students/PendingAdmissionsPage"));
const AttendanceMarkPage = lazy(() => import("../features/attendance/AttendanceMarkPage"));
const StudentPromotionPage = lazy(() => import("../features/students/StudentPromotionPage"));
const ClassExamRoutinePage = lazy(() => import("../features/routine/ClassExamRoutinePage"));
const FeeManagementPage = lazy(() => import("../features/fee/FeeManagementPage"));
const StudentStatementPage = lazy(() => import("../features/fee/StudentStatementPage"));
const PayrollPage = lazy(() => import("../features/payroll/PayrollPage"));
const PaymentMethodSettingsPage = lazy(() => import("../features/fee/PaymentMethodSettingsPage"));
const RolesPermissionsPage = lazy(() => import("../features/roles/RolesPermissionsPage"));
const UsersPage = lazy(() => import("../features/users/UsersPage"));
const NotificationsPage = lazy(() => import("../features/notifications/NotificationsPage"));

const TeacherAdmissionPage = lazy(() => import("../features/teachers/TeacherPage"));
const TeacherListPage = lazy(() => import("../features/teachers/TeacherListPage"));
const TeacherProfilePage = lazy(() => import("../features/teachers/TeacherProfilePage"));

const AcademicReportPage = lazy(() => import("../features/reports/AcademicReportPage"));
const StudentReportPage = lazy(() => import("../features/reports/StudentReportPage"));
const ExamReportPage = lazy(() => import("../features/reports/ExamReportPage"));
const TeacherReportPage = lazy(() => import("../features/reports/TeacherReportPage"));
const DocumentsReportPage = lazy(() => import("../features/reports/DocumentsReportPage"));

const ReportPage = lazy(() => import("../features/accounts/ReportPage"));
const IncomePage = lazy(() => import("../features/accounts/IncomePage"));
const ExpensePage = lazy(() => import("../features/accounts/ExpensePage"));
const AccountListPage = lazy(() => import("../features/accounts/AccountListPage"));

const TeacherAssignmentPanel = lazy(() => import("../features/talimat/TeacherAssignmentPanel"));
const ClassPanel = lazy(() => import("../features/talimat/ClassPanel"));
const ExamPanel = lazy(() => import("../features/talimat/ExamPanel"));
const ResultPreviewPage = lazy(() => import("../features/talimat/ResultPreviewPage"));
const ResultEntryPage = lazy(() => import("../features/talimat/ResultEntryPage"));
const TalimatDocumentsPage = lazy(() => import("../features/talimat/TalimatDocumentsPage"));
const TenantDocumentDesignerPage = lazy(() => import("../features/talimat/TenantDocumentDesignerPage"));

const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const AdminWebsiteSettingsPage = lazy(
  () => import("../features/admin/website-builder/AdminWebsiteSettingsPage"),
);
const BrandingSettingsPage = lazy(() => import("../features/admin/settings/BrandingSettingsPage"));
const ProfileSettingsPage = lazy(() => import("../features/admin/settings/ProfileSettingsPage"));
const TrashPage = lazy(() => import("../features/admin/TrashPage"));

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
const SuperAdminDocumentTemplatesPage = lazy(
  () => import("../features/super-admin/document-templates/SuperAdminDocumentTemplatesPage"),
);
const SuperAdminDocumentTemplateEditorPage = lazy(
  () => import("../features/super-admin/document-templates/SuperAdminDocumentTemplateEditorPage"),
);
const SuperAdminSettingsPage = lazy(
  () => import("../features/super-admin/settings/SuperAdminSettingsPage"),
);

const PublicWebsitePage = lazy(() => import("../features/public/website/PublicWebsitePage"));
const AdmissionApplyPage = lazy(() => import("../features/public/website/AdmissionApplyPage"));
const QmsLandingPage = lazy(() => import("../features/public/landing/QmsLandingPage"));
const NotFoundPage = lazy(() => import("../features/common/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("../features/common/UnauthorizedPage"));

// Wraps a lazy-loaded page element in its own <Suspense> boundary so each
// route shows the lightweight PageLoader while its chunk downloads, without
// blocking or being blocked by any other route's chunk.
const withSuspense = (element: JSX.Element) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

const madrasaAdminChildren = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "unauthorized", element: withSuspense(<UnauthorizedPage />) },

  {
    path: "dashboard",
    element: <ModuleGuard module="dashboard">{withSuspense(<DashboardPage />)}</ModuleGuard>,
  },

  {
    path: "ihtemam/teacher_admission",
    element: <ModuleGuard module="ihtemam">{withSuspense(<TeacherAdmissionPage />)}</ModuleGuard>,
  },
  {
    path: "ihtemam/all_teacher",
    element: <ModuleGuard module="ihtemam">{withSuspense(<TeacherListPage />)}</ModuleGuard>,
  },
  {
    path: "ihtemam/pending",
    element: <ModuleGuard module="ihtemam">{withSuspense(<PendingAdmissionsPage />)}</ModuleGuard>,
  },
  {
    path: "ihtemam/:id",
    element: <ModuleGuard module="ihtemam">{withSuspense(<TeacherProfilePage />)}</ModuleGuard>,
  },

  {
    path: "reports/academic-report",
    element: <ModuleGuard module="reports">{withSuspense(<AcademicReportPage />)}</ModuleGuard>,
  },
  {
    path: "reports/student_report",
    element: <ModuleGuard module="reports">{withSuspense(<StudentReportPage />)}</ModuleGuard>,
  },
  {
    path: "reports/exam_report",
    element: <ModuleGuard module="reports">{withSuspense(<ExamReportPage />)}</ModuleGuard>,
  },
  {
    path: "reports/teacher_report",
    element: <ModuleGuard module="reports">{withSuspense(<TeacherReportPage />)}</ModuleGuard>,
  },
  {
    path: "reports/documents",
    element: <ModuleGuard module="reports">{withSuspense(<DocumentsReportPage />)}</ModuleGuard>,
  },

  {
    path: "talimat/class_panel",
    element: <ModuleGuard module="talimat">{withSuspense(<ClassPanel />)}</ModuleGuard>,
  },
  {
    path: "talimat/teacher_assignment",
    element: <ModuleGuard module="talimat">{withSuspense(<TeacherAssignmentPanel />)}</ModuleGuard>,
  },
  {
    path: "talimat/exam_panel",
    element: <ModuleGuard module="talimat">{withSuspense(<ExamPanel />)}</ModuleGuard>,
  },
  {
    path: "talimat/results",
    element: <ModuleGuard module="talimat">{withSuspense(<ResultPreviewPage />)}</ModuleGuard>,
  },
  {
    path: "talimat/results/entry",
    element: <ModuleGuard module="talimat">{withSuspense(<ResultEntryPage />)}</ModuleGuard>,
  },
  {
    path: "talimat/documents",
    element: <ModuleGuard module="talimat">{withSuspense(<TalimatDocumentsPage />)}</ModuleGuard>,
  },
  {
    path: "talimat/documents/:type/:id/edit",
    element: <ModuleGuard module="talimat">{withSuspense(<TenantDocumentDesignerPage />)}</ModuleGuard>,
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
    element: <ModuleGuard module="students">{withSuspense(<AdmissionPage />)}</ModuleGuard>,
  },
  {
    path: "students/admissions/pending",
    element: <ModuleGuard module="students">{withSuspense(<PendingAdmissionsPage />)}</ModuleGuard>,
  },
  {
    path: "students/list",
    element: <ModuleGuard module="students">{withSuspense(<StudentListPage />)}</ModuleGuard>,
  },
  {
    path: "attendance/mark",
    element: <ModuleGuard module="students">{withSuspense(<AttendanceMarkPage />)}</ModuleGuard>,
  },
  {
    path: "students/promotion",
    element: <ModuleGuard module="students">{withSuspense(<StudentPromotionPage />)}</ModuleGuard>,
  },
  {
    path: "routine",
    element: <ModuleGuard module="students">{withSuspense(<ClassExamRoutinePage />)}</ModuleGuard>,
  },
  {
    path: "fee-management",
    element: <ModuleGuard module="accounts">{withSuspense(<FeeManagementPage />)}</ModuleGuard>,
  },
  {
    path: "students/statement",
    element: <ModuleGuard module="accounts">{withSuspense(<StudentStatementPage />)}</ModuleGuard>,
  },
  {
    path: "payroll",
    element: <ModuleGuard module="accounts">{withSuspense(<PayrollPage />)}</ModuleGuard>,
  },
  {
    path: "students/:id",
    element: <ModuleGuard module="students">{withSuspense(<StudentProfilePage />)}</ModuleGuard>,
  },

  {
    path: "accounts/report",
    element: <ModuleGuard module="accounts">{withSuspense(<ReportPage />)}</ModuleGuard>,
  },
  {
    path: "accounts/income",
    element: <ModuleGuard module="accounts">{withSuspense(<IncomePage />)}</ModuleGuard>,
  },
  {
    path: "accounts/expense",
    element: <ModuleGuard module="accounts">{withSuspense(<ExpensePage />)}</ModuleGuard>,
  },
  {
    path: "accounts/transactions",
    element: <ModuleGuard module="accounts">{withSuspense(<AccountListPage />)}</ModuleGuard>,
  },

  {
    path: "settings/profile",
    element: withSuspense(<ProfileSettingsPage />),
  },
  {
    path: "settings/website",
    element: (
      <ModuleGuard module="website">{withSuspense(<AdminWebsiteSettingsPage />)}</ModuleGuard>
    ),
  },
  {
    path: "settings/branding",
    element: <ModuleGuard module="settings">{withSuspense(<BrandingSettingsPage />)}</ModuleGuard>,
  },
  {
    path: "settings/payment-methods",
    element: (
      <ModuleGuard module="settings">{withSuspense(<PaymentMethodSettingsPage />)}</ModuleGuard>
    ),
  },
  {
    path: "settings/roles",
    element: <ModuleGuard module="settings">{withSuspense(<RolesPermissionsPage />)}</ModuleGuard>,
  },
  {
    path: "settings/users",
    element: <ModuleGuard module="settings">{withSuspense(<UsersPage />)}</ModuleGuard>,
  },
  {
    path: "settings/trash",
    element: <ModuleGuard module="settings">{withSuspense(<TrashPage />)}</ModuleGuard>,
  },
  {
    path: "notifications",
    element: <ModuleGuard module="settings">{withSuspense(<NotificationsPage />)}</ModuleGuard>,
  },

  {
    path: "activity",
    element: <ModuleGuard module="activity">{withSuspense(<ActivityPage />)}</ModuleGuard>,
  },

  { path: "*", element: withSuspense(<NotFoundPage />) },
];

export const router = createBrowserRouter([
  // QMS product landing page — shown at the root domain (e.g. https://qms.hikmahit.com)
  { path: "/", element: withSuspense(<QmsLandingPage />) },

  { path: "/super-admin/login", element: <SuperAdminLoginPage /> },
  {
    path: "/super-admin",
    element: <SuperAdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: withSuspense(<SuperAdminDashboardPage />) },
      { path: "madrasas", element: withSuspense(<SuperAdminMadrasasPage />) },
      { path: "madrasas/trash", element: withSuspense(<SuperAdminMadrasasTrashPage />) },
      { path: "plans", element: withSuspense(<SuperAdminPlansPage />) },
      { path: "document-templates", element: withSuspense(<SuperAdminDocumentTemplatesPage />) },
      {
        path: "document-templates/:id/edit",
        element: withSuspense(<SuperAdminDocumentTemplateEditorPage />),
      },
      { path: "websites", element: withSuspense(<SuperAdminWebsiteControlPage />) },
      { path: "settings", element: withSuspense(<SuperAdminSettingsPage />) },
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
  { path: "/m/:madrasaSlug/admission", element: withSuspense(<AdmissionApplyPage />) },

  { path: "/:madrasaSlug/admin/login", element: <LoginPage /> },
  {
    path: "/:madrasaSlug/admin/forgot-password",
    element: withSuspense(<ForgotPasswordPage />),
  },
  {
    path: "/:madrasaSlug/admin/reset-password",
    element: withSuspense(<ResetPasswordPage />),
  },
  {
    path: "/:madrasaSlug/admin",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: madrasaAdminChildren,
  },

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
  { path: "/:madrasaSlug", element: withSuspense(<PublicWebsitePage />) },

  { path: "*", element: withSuspense(<NotFoundPage />) },
]);
