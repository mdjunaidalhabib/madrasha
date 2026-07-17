import { Router } from "express";

/* =========================
   IMPORT ROUTES
========================= */

// 🔐 Auth & Core
import authRoutes from "../modules/auth/auth.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import userRoutes from "../modules/users/user.routes";
import settingsRoutes from "../modules/settings/settings.routes";
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

/* =========================
   CORE MODULES
========================= */

router.use("/users", userRoutes);
router.use("/settings", settingsRoutes);
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

export default router;
