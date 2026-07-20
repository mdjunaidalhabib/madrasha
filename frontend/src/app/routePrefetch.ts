const routeLoaders: Record<string, () => Promise<unknown>> = {
  dashboard: () => import("../features/dashboard/DashboardPage"),
  "ihtemam/teacher_admission": () => import("../features/teachers/TeacherPage"),
  "ihtemam/all_teacher": () => import("../features/teachers/TeacherListPage"),
  "reports/academic-report": () => import("../features/reports/AcademicReportPage"),
  "reports/student_report": () => import("../features/reports/StudentReportPage"),
  "reports/exam_report": () => import("../features/reports/ExamReportPage"),
  "reports/teacher_report": () => import("../features/reports/TeacherReportPage"),
  "reports/documents": () => import("../features/reports/DocumentsReportPage"),
  "talimat/class_panel": () => import("../features/talimat/ClassPanel"),
  "talimat/teacher_assignment": () => import("../features/talimat/TeacherAssignmentPanel"),
  "talimat/exam_panel": () => import("../features/talimat/ExamPanel"),
  "talimat/results": () => import("../features/talimat/ResultPreviewPage"),
  "talimat/results/entry": () => import("../features/talimat/ResultEntryPage"),
  "talimat/documents": () => import("../features/talimat/TalimatDocumentsPage"),
  "students/new_admission": () => import("../features/students/AdmissionPage"),
  "students/list": () => import("../features/students/StudentListPage"),
  "accounts/report": () => import("../features/accounts/ReportPage"),
  "accounts/income": () => import("../features/accounts/IncomePage"),
  "accounts/expense": () => import("../features/accounts/ExpensePage"),
  "website-settings": () => import("../features/admin/website-builder/AdminWebsiteSettingsPage"),
  settings: () => import("../features/admin/settings/SettingsPage"),
  "settings/branding": () => import("../features/admin/settings/BrandingSettingsPage"),
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
