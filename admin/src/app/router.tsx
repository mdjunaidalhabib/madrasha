import { lazy, Suspense, type JSX } from "react";
import { Navigate, createBrowserRouter, useParams } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import AuthGuard from "../components/guards/AuthGuard";
import ModuleGuard from "../components/guards/ModuleGuard";
import PermissionGuard from "../components/guards/PermissionGuard";
import PageLoader from "@madrasha/shared-ui/src/components/ui/PageLoader";
import LoginPage from "../features/auth/LoginPage";
const ForgotPasswordPage = lazy(() => import("../features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../features/auth/ResetPasswordPage"));

// All page-level components are lazy-loaded so that a visitor to any one
// route only downloads the JS for that route, instead of the entire app
// (every feature module) up front. Without this, every visitor — even one
// who never logs in — had to wait for the whole bundle before anything
// rendered.
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const HikmahItPage = lazy(() => import("../features/vendor/HikmahItPage"));
const StudentsDashboardPage = lazy(() => import("../features/students/StudentsDashboardPage"));
const StudentListPage = lazy(() => import("../features/students/StudentListPage"));
const StudentProfilePage = lazy(() => import("../features/students/StudentProfilePage"));
const StudentProfile360 = lazy(() => import("../features/students/StudentProfile360"));
const AdmissionPage = lazy(() => import("../features/students/AdmissionPage"));
const PendingAdmissionsPage = lazy(() => import("../features/students/PendingAdmissionsPage"));
const AttendanceMarkPage = lazy(() => import("../features/attendance/AttendanceMarkPage"));
const AttendanceKioskDevicesPage = lazy(() => import("../features/attendance/AttendanceKioskDevicesPage"));
const AttendanceReportPage = lazy(() => import("../features/attendance/AttendanceReportPage"));
const StudentPromotionPage = lazy(() => import("../features/students/StudentPromotionPage"));
const SessionPage = lazy(() => import("../features/session/SessionPage"));
const ClassExamRoutinePage = lazy(() => import("../features/routine/ClassExamRoutinePage"));
const FeeDashboardPage = lazy(() => import("../features/fee/FeeDashboardPage"));
const FeeStructurePage = lazy(() => import("../features/fee/FeeStructurePage"));
const FeeCategorySettingsPage = lazy(() => import("../features/fee/FeeCategorySettingsPage"));
const FeeInvoicesPage = lazy(() => import("../features/fee/FeeInvoicesPage"));
const PendingAdmissionFeePage = lazy(() => import("../features/fee/PendingAdmissionFeePage"));
const OverdueFeesPage = lazy(() => import("../features/fee/OverdueFeesPage"));
const PayrollPage = lazy(() => import("../features/payroll/PayrollPage"));
const PaymentMethodSettingsPage = lazy(() => import("../features/fee/PaymentMethodSettingsPage"));
const RolesPermissionsPage = lazy(() => import("../features/roles/RolesPermissionsPage"));
const UsersPage = lazy(() => import("../features/users/UsersPage"));
const SingleSendPage = lazy(() => import("../features/notifications/SingleSendPage"));
const BulkSendPage = lazy(() => import("../features/notifications/BulkSendPage"));
const NotificationHistoryPage = lazy(() => import("../features/notifications/NotificationHistoryPage"));
const CommunicationDashboardPage = lazy(
  () => import("../features/notifications/CommunicationDashboardPage"),
);
const AutoNotificationSettingsPage = lazy(
  () => import("../features/notifications/AutoNotificationSettingsPage"),
);
const BillingDashboardPage = lazy(() => import("../features/billing/BillingDashboardPage"));

const LibraryDashboardPage = lazy(() => import("../features/library/LibraryDashboardPage"));
const LibraryCatalogPage = lazy(() => import("../features/library/LibraryCatalogPage"));
const LibraryCirculationPage = lazy(() => import("../features/library/LibraryCirculationPage"));
const LibraryOverdueFinesPage = lazy(() => import("../features/library/LibraryOverdueFinesPage"));
const LibrarySettingsPage = lazy(() => import("../features/library/LibrarySettingsPage"));

const TeacherStaffDashboardPage = lazy(() => import("../features/teachers/TeacherStaffDashboardPage"));
const TeacherAdmissionPage = lazy(() => import("../features/teachers/TeacherPage"));
const TeacherListPage = lazy(() => import("../features/teachers/TeacherListPage"));
const TeacherProfilePage = lazy(() => import("../features/teachers/TeacherProfilePage"));
const StaffAdmissionPage = lazy(() => import("../features/staff/StaffPage"));
const StaffListPage = lazy(() => import("../features/staff/StaffListPage"));
const StaffProfilePage = lazy(() => import("../features/staff/StaffProfilePage"));

const AcademicReportPage = lazy(() => import("../features/reports/AcademicReportPage"));
const StudentReportPage = lazy(() => import("../features/reports/StudentReportPage"));
const ExamReportPage = lazy(() => import("../features/reports/ExamReportPage"));
const TeacherReportPage = lazy(() => import("../features/reports/TeacherReportPage"));
const DocumentsReportPage = lazy(() => import("../features/reports/DocumentsReportPage"));

const ReportPage = lazy(() => import("../features/accounts/ReportPage"));
const IncomePage = lazy(() => import("../features/accounts/IncomePage"));
const ExpensePage = lazy(() => import("../features/accounts/ExpensePage"));
const AccountListPage = lazy(() => import("../features/accounts/AccountListPage"));
const AccountDashboardPage = lazy(() => import("../features/accounts/AccountDashboardPage"));
const AccountFundSettingsPage = lazy(() => import("../features/accounts/AccountFundSettingsPage"));

const TalimatDashboardPage = lazy(() => import("../features/talimat/TalimatDashboardPage"));
const TeacherAssignmentPanel = lazy(() => import("../features/talimat/TeacherAssignmentPanel"));
const ResultPreviewPage = lazy(() => import("../features/talimat/ResultPreviewPage"));
const ResultEntryPage = lazy(() => import("../features/talimat/ResultEntryPage"));
const TalimatDocumentsPage = lazy(() => import("../features/talimat/TalimatDocumentsPage"));
const TenantDocumentDesignerPage = lazy(() => import("../features/talimat/TenantDocumentDesignerPage"));
const TalimatSettingsLayout = lazy(() => import("../features/talimat/settings/TalimatSettingsLayout"));
const ClassBookSettingsPage = lazy(
  () => import("../features/talimat/settings/ClassBookSettingsPage"),
);
const ExamSettingsPage = lazy(() => import("../features/talimat/settings/ExamSettingsPage"));
const GradeSettingsPage = lazy(() => import("../features/talimat/settings/GradeSettingsPage"));

const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const AdminWebsiteSettingsPage = lazy(
  () => import("../features/admin/website-builder/AdminWebsiteSettingsPage"),
);
const BrandingSettingsPage = lazy(() => import("../features/admin/settings/BrandingSettingsPage"));
const ProfileSettingsPage = lazy(() => import("../features/admin/settings/ProfileSettingsPage"));
const PlanSettingsPage = lazy(() => import("../features/admin/settings/PlanSettingsPage"));
const SettingsLayout = lazy(() => import("../features/admin/settings/SettingsLayout"));
const TrashPage = lazy(() => import("../features/admin/TrashPage"));

const NotFoundPage = lazy(() => import("../features/common/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("../features/common/UnauthorizedPage"));

// Wraps a lazy-loaded page element in its own <Suspense> boundary so each
// route shows the lightweight PageLoader while its chunk downloads, without
// blocking or being blocked by any other route's chunk.
const withSuspense = (element: JSX.Element) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

// Old ইহতিমাম/:id teacher-profile links (bookmarks, already-open tabs) redirect
// to the new শিক্ষক স্টাফ path — <Navigate to> can't interpolate a route param
// on its own, so this reads it and builds the target path itself.
const LegacyTeacherProfileRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`../teacher_staff/teacher/${id}`} replace />;
};

const madrasaAdminChildren = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "unauthorized", element: withSuspense(<UnauthorizedPage />) },

  {
    path: "dashboard",
    element: <ModuleGuard module="dashboard">{withSuspense(<DashboardPage />)}</ModuleGuard>,
  },
  // Not module-gated — every tenant admin can see who built/maintains their
  // QMS, regardless of which modules their madrasa has activated.
  { path: "hikmah-it", element: withSuspense(<HikmahItPage />) },

  {
    path: "ihtemam/pending",
    element: <ModuleGuard module="ihtemam">{withSuspense(<PendingAdmissionsPage />)}</ModuleGuard>,
  },
  {
    path: "ihtemam/fee-categories",
    element: <ModuleGuard module="ihtemam">{withSuspense(<FeeCategorySettingsPage />)}</ModuleGuard>,
  },

  {
    path: "teacher_staff/dashboard",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<TeacherStaffDashboardPage />)}</ModuleGuard>,
  },
  {
    path: "teacher_staff/teacher_admission",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<TeacherAdmissionPage />)}</ModuleGuard>,
  },
  {
    path: "teacher_staff/all_teacher",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<TeacherListPage />)}</ModuleGuard>,
  },
  {
    path: "teacher_staff/teacher/:id",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<TeacherProfilePage />)}</ModuleGuard>,
  },
  {
    path: "teacher_staff/staff_admission",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<StaffAdmissionPage />)}</ModuleGuard>,
  },
  {
    path: "teacher_staff/all_staff",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<StaffListPage />)}</ModuleGuard>,
  },
  {
    path: "teacher_staff/staff/:id",
    element: <ModuleGuard module="teacher_staff">{withSuspense(<StaffProfilePage />)}</ModuleGuard>,
  },
  // Old ইহতিমাম teacher routes redirect to their new home under শিক্ষক স্টাফ.
  { path: "ihtemam/teacher_admission", element: <Navigate to="../teacher_staff/teacher_admission" replace /> },
  { path: "ihtemam/all_teacher", element: <Navigate to="../teacher_staff/all_teacher" replace /> },
  { path: "ihtemam/:id", element: <LegacyTeacherProfileRedirect /> },

  {
    path: "reports/academic-report",
    element: (
      <ModuleGuard module="reports">
        <PermissionGuard permission="reports.read">{withSuspense(<AcademicReportPage />)}</PermissionGuard>
      </ModuleGuard>
    ),
  },
  {
    path: "reports/student_report",
    element: (
      <ModuleGuard module="reports">
        <PermissionGuard permission="reports.read">{withSuspense(<StudentReportPage />)}</PermissionGuard>
      </ModuleGuard>
    ),
  },
  {
    path: "reports/exam_report",
    element: (
      <ModuleGuard module="reports">
        <PermissionGuard permission="reports.read">{withSuspense(<ExamReportPage />)}</PermissionGuard>
      </ModuleGuard>
    ),
  },
  {
    path: "reports/teacher_report",
    element: (
      <ModuleGuard module="reports">
        <PermissionGuard permission="reports.read">{withSuspense(<TeacherReportPage />)}</PermissionGuard>
      </ModuleGuard>
    ),
  },
  {
    path: "reports/documents",
    element: (
      <ModuleGuard module="reports">
        <PermissionGuard permission="reports.read">{withSuspense(<DocumentsReportPage />)}</PermissionGuard>
      </ModuleGuard>
    ),
  },

  {
    path: "talimat/dashboard",
    element: <ModuleGuard module="talimat">{withSuspense(<TalimatDashboardPage />)}</ModuleGuard>,
  },
  {
    path: "talimat/teacher_assignment",
    element: (
      <ModuleGuard module="talimat">
        <PermissionGuard permission="talimat.manage">{withSuspense(<TeacherAssignmentPanel />)}</PermissionGuard>
      </ModuleGuard>
    ),
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
    path: "talimat/settings",
    element: <ModuleGuard module="talimat">{withSuspense(<TalimatSettingsLayout />)}</ModuleGuard>,
    children: [
      { index: true, element: <Navigate to="class-book" replace /> },
      { path: "class-book", element: withSuspense(<ClassBookSettingsPage />) },
      { path: "exam", element: withSuspense(<ExamSettingsPage />) },
      { path: "grade", element: withSuspense(<GradeSettingsPage />) },
      {
        path: "documents",
        element: (
          <PermissionGuard permission="document_templates.read">
            {withSuspense(<TalimatDocumentsPage />)}
          </PermissionGuard>
        ),
      },
      { path: "sessions", element: withSuspense(<SessionPage />) },
    ],
  },
  {
    path: "talimat/settings/documents/:type/:id/edit",
    element: (
      <ModuleGuard module="talimat">
        <PermissionGuard permission="document_templates.read">
          {withSuspense(<TenantDocumentDesignerPage />)}
        </PermissionGuard>
      </ModuleGuard>
    ),
  },
  // NOTE: class_panel / exam_panel / documents were 4 separate তালিমাত
  // sidebar entries (plus students/sessions). They're now sub-pages of the
  // single "সেটিং" hub above. Old links redirect there, same pattern as the
  // id_card/admit_card/certificate/testimonial/transfer_letter redirects below.
  { path: "talimat/class_panel", element: <Navigate to="../talimat/settings/class-book" replace /> },
  { path: "talimat/exam_panel", element: <Navigate to="../talimat/settings/exam" replace /> },
  { path: "talimat/documents", element: <Navigate to="../talimat/settings/documents" replace /> },
  // NOTE: id_card / admit_card / certificate / testimonial / transfer_letter
  // used to be 5 separate routes that all rendered the exact same page.
  // They are now consolidated into the single "talimat/settings/documents"
  // route above (with tabs inside the page for each document type). Old
  // links redirect there.
  { path: "talimat/id_card", element: <Navigate to="../talimat/settings/documents" replace /> },
  { path: "talimat/admit_card", element: <Navigate to="../talimat/settings/documents" replace /> },
  { path: "talimat/certificate", element: <Navigate to="../talimat/settings/documents" replace /> },
  { path: "talimat/testimonial", element: <Navigate to="../talimat/settings/documents" replace /> },
  { path: "talimat/transfer_letter", element: <Navigate to="../talimat/settings/documents" replace /> },

  {
    path: "students/dashboard",
    element: <ModuleGuard module="students">{withSuspense(<StudentsDashboardPage />)}</ModuleGuard>,
  },
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
    element: <ModuleGuard module="attendance">{withSuspense(<AttendanceMarkPage />)}</ModuleGuard>,
  },
  {
    path: "attendance/kiosk-devices",
    element: <ModuleGuard module="attendance">{withSuspense(<AttendanceKioskDevicesPage />)}</ModuleGuard>,
  },
  {
    path: "attendance/report",
    element: <ModuleGuard module="attendance">{withSuspense(<AttendanceReportPage />)}</ModuleGuard>,
  },
  {
    path: "students/promotion",
    element: <ModuleGuard module="students">{withSuspense(<StudentPromotionPage />)}</ModuleGuard>,
  },
  // "সেশন সেটাপ" moved under তালিমাত > সেটিং - old link redirects there.
  { path: "students/sessions", element: <Navigate to="../talimat/settings/sessions" replace /> },
  {
    path: "routine",
    element: <ModuleGuard module="students">{withSuspense(<ClassExamRoutinePage />)}</ModuleGuard>,
  },
  {
    path: "fee-management",
    element: <ModuleGuard module="ihtemam">{withSuspense(<FeeStructurePage />)}</ModuleGuard>,
  },
  {
    path: "fee-collection",
    element: <ModuleGuard module="fee">{withSuspense(<FeeInvoicesPage />)}</ModuleGuard>,
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
    path: "students/:id/profile",
    element: <ModuleGuard module="students">{withSuspense(<StudentProfile360 />)}</ModuleGuard>,
  },

  {
    path: "accounts/dashboard",
    element: <ModuleGuard module="accounts">{withSuspense(<AccountDashboardPage />)}</ModuleGuard>,
  },
  {
    path: "fee/dashboard",
    element: <ModuleGuard module="fee">{withSuspense(<FeeDashboardPage />)}</ModuleGuard>,
  },
  {
    path: "fee/pending-fee",
    element: <ModuleGuard module="fee">{withSuspense(<PendingAdmissionFeePage />)}</ModuleGuard>,
  },
  {
    path: "fee/overdue-fee",
    element: <ModuleGuard module="fee">{withSuspense(<OverdueFeesPage />)}</ModuleGuard>,
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
    path: "accounts/funds",
    element: <ModuleGuard module="accounts">{withSuspense(<AccountFundSettingsPage />)}</ModuleGuard>,
  },

  {
    // ওয়েবসাইট সেটিংস আলাদা, standalone পেজ - সাধারণ সেটিংস হাবের ট্যাব-মেনুর
    // অংশ না (নিচের SettingsLayout দেখুন), নিজস্ব সরাসরি সাইডবার শর্টকাট আছে।
    path: "settings/website",
    element: (
      <ModuleGuard module="website">
        <PermissionGuard permission="website.manage">{withSuspense(<AdminWebsiteSettingsPage />)}</PermissionGuard>
      </ModuleGuard>
    ),
  },
  {
    // সাধারণ সেটিংসের সব সাব-পেজ (website বাদে) একটা শেয়ার্ড লেআউটের নিচে -
    // main content field-এ নিজস্ব মেনু (ট্যাব) দেখায় (দেখুন SettingsLayout.tsx,
    // তালিমাত সেটিং লেআউটের একই প্যাটার্ন অনুসরণ করে)।
    path: "settings",
    element: withSuspense(<SettingsLayout />),
    children: [
      { index: true, element: <Navigate to="profile" replace /> },
      { path: "profile", element: withSuspense(<ProfileSettingsPage />) },
      { path: "plan", element: withSuspense(<PlanSettingsPage />) },
      {
        path: "branding",
        element: (
          <ModuleGuard module="settings">
            <PermissionGuard permission="settings.manage">{withSuspense(<BrandingSettingsPage />)}</PermissionGuard>
          </ModuleGuard>
        ),
      },
      {
        path: "payment-methods",
        element: (
          <ModuleGuard module="settings">{withSuspense(<PaymentMethodSettingsPage />)}</ModuleGuard>
        ),
      },
      {
        path: "roles",
        element: (
          <ModuleGuard module="settings">
            <PermissionGuard permission="roles.manage">{withSuspense(<RolesPermissionsPage />)}</PermissionGuard>
          </ModuleGuard>
        ),
      },
      {
        path: "users",
        element: (
          <ModuleGuard module="settings">
            <PermissionGuard permission="users.read">{withSuspense(<UsersPage />)}</PermissionGuard>
          </ModuleGuard>
        ),
      },
      {
        path: "trash",
        element: <ModuleGuard module="settings">{withSuspense(<TrashPage />)}</ModuleGuard>,
      },
    ],
  },
  {
    path: "communication/dashboard",
    element: <ModuleGuard module="communication">{withSuspense(<CommunicationDashboardPage />)}</ModuleGuard>,
  },
  {
    path: "communication/single-send",
    element: <ModuleGuard module="communication">{withSuspense(<SingleSendPage />)}</ModuleGuard>,
  },
  {
    path: "communication/bulk-send",
    element: <ModuleGuard module="communication">{withSuspense(<BulkSendPage />)}</ModuleGuard>,
  },
  {
    path: "communication/history",
    element: <ModuleGuard module="communication">{withSuspense(<NotificationHistoryPage />)}</ModuleGuard>,
  },
  {
    path: "communication/auto-settings",
    element: (
      <ModuleGuard module="communication">{withSuspense(<AutoNotificationSettingsPage />)}</ModuleGuard>
    ),
  },
  {
    path: "communication/billing",
    element: <ModuleGuard module="communication">{withSuspense(<BillingDashboardPage />)}</ModuleGuard>,
  },

  {
    path: "ihtemam/activity",
    element: <ModuleGuard module="ihtemam">{withSuspense(<ActivityPage />)}</ModuleGuard>,
  },
  // Old top-level "/activity" bookmarks redirect to its new home under ইহতিমাম.
  { path: "activity", element: <Navigate to="../ihtemam/activity" replace /> },

  {
    path: "library/dashboard",
    element: <ModuleGuard module="library">{withSuspense(<LibraryDashboardPage />)}</ModuleGuard>,
  },
  {
    path: "library/catalog",
    element: <ModuleGuard module="library">{withSuspense(<LibraryCatalogPage />)}</ModuleGuard>,
  },
  {
    path: "library/circulation",
    element: <ModuleGuard module="library">{withSuspense(<LibraryCirculationPage />)}</ModuleGuard>,
  },
  {
    path: "library/overdue",
    element: <ModuleGuard module="library">{withSuspense(<LibraryOverdueFinesPage />)}</ModuleGuard>,
  },
  {
    path: "library/settings",
    element: <ModuleGuard module="library">{withSuspense(<LibrarySettingsPage />)}</ModuleGuard>,
  },

  { path: "*", element: withSuspense(<NotFoundPage />) },
];

export const router = createBrowserRouter([
  // One fixed URL for every madrasa's admin now - which tenant you're
  // managing comes from the madrasa code entered on the login form (see
  // LoginPage.tsx / authStore's madrasaSlug), not a URL segment. AuthGuard
  // already sends an unauthenticated visit to "/" straight to "/login", so
  // root "/" can directly be the dashboard shell.
  {
    path: "/",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: madrasaAdminChildren,
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: withSuspense(<ForgotPasswordPage />) },
  { path: "/reset-password", element: withSuspense(<ResetPasswordPage />) },
  // Old bookmarks from before the URL flattening.
  { path: "/admin/login", element: <Navigate to="/login" replace /> },
  { path: "/admin/*", element: <Navigate to="/dashboard" replace /> },

  // The public madrasa website, admission form, guardian portal, and
  // attendance kiosk now live in the separate "frontend" app (its own
  // domain) - see frontend/src/app/router.tsx. Only the staff-only print
  // routes below still live here, since they're rendered by the backend's
  // authenticated headless-browser PDF export, not visited by the public.

  // Chrome-less report preview, rendered for the server-side PDF export's
  // headless browser (see backend/src/modules/reports/controllers/
  // report-export.service.ts). Deliberately outside AuthGuard/DashboardLayout
  // - no sidebar, no client-side login redirect - the headless browser sets
  // its own auth state directly via localStorage before navigating here, see
  // ReportShell's printMode prop for how the filter state is hydrated from
  // this URL's query params instead of user interaction.
  { path: "/:madrasaSlug/print/reports/academic", element: withSuspense(<AcademicReportPage printMode />) },
  { path: "/:madrasaSlug/print/reports/student", element: withSuspense(<StudentReportPage printMode />) },
  { path: "/:madrasaSlug/print/reports/exam", element: withSuspense(<ExamReportPage printMode />) },
  { path: "/:madrasaSlug/print/reports/teacher", element: withSuspense(<TeacherReportPage printMode />) },
  { path: "/:madrasaSlug/print/reports/documents", element: withSuspense(<DocumentsReportPage printMode />) },

  { path: "*", element: withSuspense(<NotFoundPage />) },
]);
