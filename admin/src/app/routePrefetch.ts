const routeLoaders: Record<string, () => Promise<unknown>> = {
  dashboard: () => import("../features/dashboard/DashboardPage"),
  "ihtemam/pending": () => import("../features/students/PendingAdmissionsPage"),
  "ihtemam/rejected": () => import("../features/students/RejectedAdmissionsPage"),
  "ihtemam/fee-categories": () => import("../features/fee/FeeCategorySettingsPage"),
  "teacher_staff/teacher_admission": () => import("../features/teachers/TeacherPage"),
  "teacher_staff/all_teacher": () => import("../features/teachers/TeacherListPage"),
  "teacher_staff/staff_admission": () => import("../features/staff/StaffPage"),
  "teacher_staff/all_staff": () => import("../features/staff/StaffListPage"),
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
  "talimat/settings/registration": () => import("../features/talimat/settings/RegistrationBlockSettingsPage"),
  "students/new": () => import("../features/students/AdmissionPage"),
  students: () => import("../features/students/StudentListPage"),
  "fee-management": () => import("../features/fee/FeeStructurePage"),
  "fee-collection": () => import("../features/fee/FeeInvoicesPage"),
  "fee/pending-fee": () => import("../features/fee/PendingAdmissionFeePage"),
  "fee/overdue-fee": () => import("../features/fee/OverdueFeesPage"),
  "communication/single-send": () => import("../features/notifications/SingleSendPage"),
  "communication/bulk-send": () => import("../features/notifications/BulkSendPage"),
  "communication/history": () => import("../features/notifications/NotificationHistoryPage"),
  "communication/auto-settings": () => import("../features/notifications/AutoNotificationSettingsPage"),
  routine: () => import("../features/routine/ClassExamRoutinePage"),
  "students/promotion": () => import("../features/students/StudentPromotionPage"),
  "attendance/mark": () => import("../features/attendance/AttendanceMarkPage"),
  "attendance/devices": () => import("../features/attendance-device/AttendanceDevicesPage"),
  "attendance/device-mapping": () => import("../features/attendance-device/DeviceMappingPage"),
  "attendance/device-today": () => import("../features/attendance-device/DeviceTodayPage"),
  "students/admissions/pending": () => import("../features/students/PendingAdmissionsPage"),
  "students/admissions/rejected": () => import("../features/students/RejectedAdmissionsPage"),
  "accounts/dashboard": () => import("../features/accounts/AccountDashboardPage"),
  "accounts/report": () => import("../features/accounts/ReportPage"),
  "accounts/income": () => import("../features/accounts/IncomePage"),
  "accounts/expense": () => import("../features/accounts/ExpensePage"),
  "accounts/transactions": () => import("../features/accounts/AccountListPage"),
  "accounts/funds": () => import("../features/accounts/AccountFundSettingsPage"),
  settings: () => import("../features/admin/settings/SettingsLayout"),
  "settings/profile": () => import("../features/admin/settings/ProfileSettingsPage"),
  "settings/branding": () => import("../features/admin/settings/BrandingSettingsPage"),
  "settings/plan": () => import("../features/admin/settings/PlanSettingsPage"),
  "settings/website": () => import("../features/admin/website-builder/AdminWebsiteSettingsPage"),
  "settings/payment-methods": () => import("../features/fee/PaymentMethodSettingsPage"),
  "settings/roles": () => import("../features/roles/RolesPermissionsPage"),
  "settings/users": () => import("../features/users/UsersPage"),
  "settings/trash": () => import("../features/admin/TrashPage"),
  "ihtemam/activity": () => import("../features/activity/ActivityPage"),
  "settings/about": () => import("../features/vendor/HikmahItPage"),
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
