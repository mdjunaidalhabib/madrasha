import { Navigate, createBrowserRouter } from "react-router-dom";

import LoginPage from "../features/auth/LoginPage";
import DashboardLayout from "../layouts/DashboardLayout";
import AuthGuard from "../components/guards/AuthGuard";
import ModuleGuard from "../components/guards/ModuleGuard";

import DashboardPage from "../features/dashboard/DashboardPage";
import StudentListPage from "../features/students/StudentListPage";
import StudentProfilePage from "../features/students/StudentProfilePage";
import AdmissionPage from "../features/students/AdmissionPage";

import TeacherAdmissionPage from "../features/teachers/TeacherPage";
import TeacherListPage from "../features/teachers/TeacherListPage";
import TeacherProfilePage from "../features/teachers/TeacherProfilePage";

import AcademicReportPage from "../features/reports/AcademicReportPage";
import StudentReportPage from "../features/reports/StudentReportPage";
import TeacherReportPage from "../features/reports/TeacherReportPage";
import DocumentsReportPage from "../features/reports/DocumentsReportPage";

import ReportPage from "../features/accounts/ReportPage";
import IncomePage from "../features/accounts/IncomePage";
import ExpensePage from "../features/accounts/ExpensePage";

import TeacherAssignmentPanel from "../features/talimat/TeacherAssignmentPanel";
import ClassPanel from "../features/talimat/ClassPanel";
import ExamPanel from "../features/talimat/ExamPanel";
import ResultPreviewPage from "../features/talimat/ResultPreviewPage";
import ResultEntryPage from "../features/talimat/ResultEntryPage";
import TalimatDocumentsPage from "../features/talimat/TalimatDocumentsPage";

import ActivityPage from "../features/activity/ActivityPage";
import AdminWebsiteSettingsPage from "../features/admin/website-builder/AdminWebsiteSettingsPage";
import BrandingSettingsPage from "../features/admin/settings/BrandingSettingsPage";
import SettingsPage from "../features/admin/settings/SettingsPage";

import SuperAdminLoginPage from "../features/super-admin/auth/SuperAdminLoginPage";
import SuperAdminLayout from "../layouts/SuperAdminLayout";
import SuperAdminDashboardPage from "../features/super-admin/dashboard/SuperAdminDashboardPage";
import SuperAdminMadrasasPage from "../features/super-admin/madrasa-management/SuperAdminMadrasasPage";
import SuperAdminMadrasasTrashPage from "../features/super-admin/madrasa-management/SuperAdminMadrasasTrashPage";
import SuperAdminPlansPage from "../features/super-admin/subscriptions/SuperAdminPlansPage";
import SuperAdminWebsiteControlPage from "../features/super-admin/website-control/SuperAdminWebsiteControlPage";

import PublicWebsitePage from "../features/public/website/PublicWebsitePage";
import NotFoundPage from "../features/common/NotFoundPage";
import UnauthorizedPage from "../features/common/UnauthorizedPage";

const madrasaAdminChildren = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "unauthorized", element: <UnauthorizedPage /> },

  {
    path: "dashboard",
    element: (
      <ModuleGuard module="dashboard">
        <DashboardPage />
      </ModuleGuard>
    ),
  },

  {
    path: "ihtemam/teacher_admission",
    element: (
      <ModuleGuard module="ihtemam">
        <TeacherAdmissionPage />
      </ModuleGuard>
    ),
  },
  {
    path: "ihtemam/all_teacher",
    element: (
      <ModuleGuard module="ihtemam">
        <TeacherListPage />
      </ModuleGuard>
    ),
  },
  {
    path: "ihtemam/:id",
    element: (
      <ModuleGuard module="ihtemam">
        <TeacherProfilePage />
      </ModuleGuard>
    ),
  },

  {
    path: "reports/academic-report",
    element: (
      <ModuleGuard module="reports">
        <AcademicReportPage />
      </ModuleGuard>
    ),
  },
  {
    path: "reports/student_report",
    element: (
      <ModuleGuard module="reports">
        <StudentReportPage />
      </ModuleGuard>
    ),
  },
  {
    path: "reports/teacher_report",
    element: (
      <ModuleGuard module="reports">
        <TeacherReportPage />
      </ModuleGuard>
    ),
  },
  {
    path: "reports/documents",
    element: (
      <ModuleGuard module="reports">
        <DocumentsReportPage />
      </ModuleGuard>
    ),
  },

  {
    path: "talimat/class_panel",
    element: (
      <ModuleGuard module="talimat">
        <ClassPanel />
      </ModuleGuard>
    ),
  },
  {
    path: "talimat/teacher_assignment",
    element: (
      <ModuleGuard module="talimat">
        <TeacherAssignmentPanel />
      </ModuleGuard>
    ),
  },
  {
    path: "talimat/exam_panel",
    element: (
      <ModuleGuard module="talimat">
        <ExamPanel />
      </ModuleGuard>
    ),
  },
  {
    path: "talimat/results",
    element: (
      <ModuleGuard module="talimat">
        <ResultPreviewPage />
      </ModuleGuard>
    ),
  },
  {
    path: "talimat/results/entry",
    element: (
      <ModuleGuard module="talimat">
        <ResultEntryPage />
      </ModuleGuard>
    ),
  },
  {
    path: "talimat/documents",
    element: (
      <ModuleGuard module="talimat">
        <TalimatDocumentsPage />
      </ModuleGuard>
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
      <ModuleGuard module="students">
        <AdmissionPage />
      </ModuleGuard>
    ),
  },
  {
    path: "students/list",
    element: (
      <ModuleGuard module="students">
        <StudentListPage />
      </ModuleGuard>
    ),
  },
  {
    path: "students/:id",
    element: (
      <ModuleGuard module="students">
        <StudentProfilePage />
      </ModuleGuard>
    ),
  },

  {
    path: "accounts/report",
    element: (
      <ModuleGuard module="accounts">
        <ReportPage />
      </ModuleGuard>
    ),
  },
  {
    path: "accounts/income",
    element: (
      <ModuleGuard module="accounts">
        <IncomePage />
      </ModuleGuard>
    ),
  },
  {
    path: "accounts/expense",
    element: (
      <ModuleGuard module="accounts">
        <ExpensePage />
      </ModuleGuard>
    ),
  },

  {
    path: "website-settings",
    element: (
      <ModuleGuard module="website">
        <AdminWebsiteSettingsPage />
      </ModuleGuard>
    ),
  },

  {
    path: "settings",
    element: (
      <ModuleGuard module="settings">
        <SettingsPage />
      </ModuleGuard>
    ),
  },
  {
    path: "settings/branding",
    element: (
      <ModuleGuard module="settings">
        <BrandingSettingsPage />
      </ModuleGuard>
    ),
  },

  {
    path: "activity",
    element: (
      <ModuleGuard module="activity">
        <ActivityPage />
      </ModuleGuard>
    ),
  },

  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter([
  { path: "/super-admin/login", element: <SuperAdminLoginPage /> },
  {
    path: "/super-admin",
    element: <SuperAdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: <SuperAdminDashboardPage /> },
      { path: "madrasas", element: <SuperAdminMadrasasPage /> },
      { path: "madrasas/trash", element: <SuperAdminMadrasasTrashPage /> },
      { path: "plans", element: <SuperAdminPlansPage /> },
      { path: "websites", element: <SuperAdminWebsiteControlPage /> },
      { path: "*", element: <NotFoundPage /> },
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

  { path: "/m/:madrasaSlug", element: <PublicWebsitePage /> },

  { path: "/:madrasaSlug/admin/login", element: <LoginPage /> },
  {
    path: "/:madrasaSlug/admin",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: madrasaAdminChildren,
  },

  { path: "/:madrasaSlug", element: <PublicWebsitePage /> },

  { path: "*", element: <NotFoundPage /> },
]);
