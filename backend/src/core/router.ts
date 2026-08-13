import { Router } from "express";

/* =========================
   IMPORT ROUTES
========================= */

// 🔐 Auth & Core
import authRoutes from "../modules/auth/auth.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import userRoutes from "../modules/users/user.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import documentTemplateRoutes from "../modules/document-templates/document-templates.routes";
import activityRoutes from "../modules/activity/activity.routes";
import sidebarRoutes from "../modules/sidebar/sidebar.routes";

// 👨‍🎓 Student & Admission
import studentRoutes from "../modules/students/student.routes";

// 👨‍🎓 teacher Admission
import teacherRoutes from "../modules/teacher/teacher.routes";
import teacherAssignmentRoutes from "../modules/TeacherAssignment/teacher-assignment.routes";

// 💰 Accounts & Talimat
import accountRoutes from "../modules/accounts/account.routes";
import talimatRoutes from "../modules/talimat/talimat.routes";

// 🏫 Academic Structure
import classPanalRoutes from "../modules/classPanal/class-panel.routes";

import reportsRoutes from "../modules/reports/report.routes";
// 👑 Super Admin
import superadminRoutes from "../modules/super-admin/superadmin.routes";
import superAdminAuthRoutes from "../modules/super-admin/superadmin.auth.routes";
import examRoutes from "../modules/ExamPanel/exam.routes";
import resultsRoutes from "../modules/ResultPanel/result-panel.routes";
import websiteRoutes from "../modules/public-website/website.routes";

// 🗓️ Phase 1: Attendance, Routine, Promotion
import attendanceRoutes from "../modules/attendance/attendance.routes";
import routineRoutes from "../modules/routine/routine.routes";
import promotionRoutes from "../modules/promotion/promotion.routes";
import sessionRoutes from "../modules/session/session.routes";

// 💰 Phase 2: Fee Management
import feeRoutes from "../modules/fee/fee.routes";
import payrollRoutes from "../modules/payroll/payroll.routes";

// 🔐 Phase 3: Role & Permission Enhancement
import roleRoutes from "../modules/roles/role.routes";

// 📣 Phase 4: SMS/Email Notifications
import notificationRoutes from "../modules/notifications/notification.routes";

// 🖼️ Phase 4: Image/File Storage (Cloudinary)
import uploadRoutes from "../modules/uploads/upload.routes";

// 👨‍👩‍👧 Phase 5: Guardian Portal
import guardianRoutes from "../modules/guardian/guardian.routes";

// 🗑️ Trash (soft-delete) for Students, Teachers, Exams
import trashRoutes from "../modules/trash/trash.routes";

const router = Router();

router.use("/website", websiteRoutes);

/* =========================================================
   👑 SUPER ADMIN ROUTES
========================================================= */

// Super Admin Auth
router.use("/super-admin", superAdminAuthRoutes);

// Super Admin Panel APIs
router.use("/super", superadminRoutes);

/* =========================================================
   🔐 TENANT ROUTES (Subdomain Based)
========================================================= */

// Auth
router.use("/auth", authRoutes);

// Dashboard
router.use("/dashboard", dashboardRoutes);

// Sidebar (UI config)
router.use("/sidebar", sidebarRoutes);

/* =========================================================
   👨‍👩‍👧 GUARDIAN PORTAL
   Mounted here (before any "/"-root-mounted router below, e.g.
   examRoutes/routineRoutes/feeRoutes/roleRoutes) on purpose. Those
   routers apply a blanket `router.use(tenantMiddleware, authMiddleware)`
   with no path prefix, so once Express enters ANY router mounted at
   "/", that router's own top-level middleware runs for every request
   that reaches it - including ones meant for routes registered further
   down the chain, like /guardian/login (deliberately public) and every
   other /guardian/* route (guarded by guardianAuthMiddleware, not the
   admin authMiddleware, which now explicitly rejects guardian tokens).
   Mounting /guardian before those routers ensures Express matches it
   first, so it's never accidentally shadowed by an unrelated module's
   auth check.
========================================================= */
router.use("/guardian", guardianRoutes);

/* =========================
   CORE MODULES
========================= */

router.use("/users", userRoutes);
router.use("/settings", settingsRoutes);
router.use("/document-templates", documentTemplateRoutes);
router.use("/activity", activityRoutes);

/* =========================
   STUDENT MODULE
========================= */

router.use("/students", studentRoutes);
/* =========================
   TEACHER MODULE
========================= */
router.use("/teachers", teacherRoutes);
router.use("/teacher-assignments", teacherAssignmentRoutes);
/* =========================
   FINANCE & TALIMAT
========================= */

router.use("/accounts", accountRoutes);
router.use("/talimat", talimatRoutes);
router.use("/", examRoutes);
router.use("/results", resultsRoutes);

router.use("/reports", reportsRoutes);

/* =========================
   ACADEMIC STRUCTURE
========================= */
router.use("/", classPanalRoutes);
router.use("/sessions", sessionRoutes);

/* =========================
   PHASE 1: ATTENDANCE, ROUTINE, PROMOTION
========================= */
router.use("/attendance", attendanceRoutes);
router.use("/", routineRoutes);
router.use("/promotion", promotionRoutes);

/* =========================
   PHASE 2: FEE MANAGEMENT
========================= */
router.use("/", feeRoutes);
router.use("/payroll", payrollRoutes);

/* =========================
   PHASE 3: ROLE & PERMISSION
========================= */
router.use("/", roleRoutes);

/* =========================
   PHASE 4: NOTIFICATIONS
========================= */
router.use("/notifications", notificationRoutes);

/* =========================
   PHASE 4: FILE STORAGE
========================= */
router.use("/uploads", uploadRoutes);

/* =========================
   TRASH (SOFT-DELETE)
========================= */
router.use("/trash", trashRoutes);

export default router;
