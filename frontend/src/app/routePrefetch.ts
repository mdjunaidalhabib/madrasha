const routeLoaders: Record<string, () => Promise<unknown>> = {
  dashboard: () => import("../features/dashboard/DashboardPage"),
  "ihtemam/teacher_admission": () => import("../features/teachers/TeacherPage"),
  "ihtemam/all_teacher": () => import("../features/teachers/TeacherListPage"),
  "ihtemam/pending": () => import("../features/students/PendingAdmissionsPage"),
  "reports/academic-report": () => import("../features/reports/AcademicReportPage"),
  "reports/student_report": () => import("../features/reports/StudentReportPage"),
  "reports/exam_report": () => import("../features/reports/ExamReportPage"),
  "reports/teacher_report": () => import("../features/reports/TeacherReportPage"),
  "reports/documents": () => import("../features/reports/DocumentsReportPage"),
  "talimat/teacher_assignment": () => import("../features/talimat/TeacherAssignmentPanel"),
  "talimat/results": () => import("../features/talimat/ResultPreviewPage"),
  "talimat/results/entry": () => import("../features/talimat/ResultEntryPage"),
  "talimat/settings": () => import("../features/talimat/settings/TalimatSettingsLayout"),
  "talimat/settings/class-book": () => import("../features/talimat/settings/ClassBookSettingsPage"),
  "talimat/settings/exam": () => import("../features/talimat/settings/ExamSettingsPage"),
  "talimat/settings/grade": () => import("../features/talimat/settings/GradeSettingsPage"),
  "talimat/settings/documents": () => import("../features/talimat/TalimatDocumentsPage"),
  "talimat/settings/sessions": () => import("../features/session/SessionPage"),
  "students/new_admission": () => import("../features/students/AdmissionPage"),
  "students/list": () => import("../features/students/StudentListPage"),
  "fee-management": () => import("../features/fee/FeeStructurePage"),
  "fee-collection": () => import("../features/fee/FeeInvoicesPage"),
  "communication/single-send": () => import("../features/notifications/SingleSendPage"),
  "communication/bulk-send": () => import("../features/notifications/BulkSendPage"),
  "communication/history": () => import("../features/notifications/NotificationHistoryPage"),
  "communication/auto-settings": () => import("../features/notifications/AutoNotificationSettingsPage"),
  routine: () => import("../features/routine/ClassExamRoutinePage"),
  "students/promotion": () => import("../features/students/StudentPromotionPage"),
  "attendance/mark": () => import("../features/attendance/AttendanceMarkPage"),
  "students/admissions/pending": () => import("../features/students/PendingAdmissionsPage"),
  "accounts/dashboard": () => import("../features/accounts/AccountDashboardPage"),
  "accounts/report": () => import("../features/accounts/ReportPage"),
  "accounts/income": () => import("../features/accounts/IncomePage"),
  "accounts/expense": () => import("../features/accounts/ExpensePage"),
  "accounts/transactions": () => import("../features/accounts/AccountListPage"),
  "accounts/funds": () => import("../features/accounts/AccountFundSettingsPage"),
  "settings/branding": () => import("../features/admin/settings/BrandingSettingsPage"),
  "settings/website": () => import("../features/admin/website-builder/AdminWebsiteSettingsPage"),
  activity: () => import("../features/activity/ActivityPage"),
};

const prefetchedRoutes = new Set<string>();

/** Download a page chunk when the user hovers/focuses its menu item. */
export function prefetchAdminRoute(path: string) {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  const loader = routeLoaders[normalized];
  if (!loader || prefetchedRoutes.has(normalized)) return;

  prefetchedRoutes.add(normalized);
  void loader().catch(() => prefetchedRoutes.delete(normalized));
}
