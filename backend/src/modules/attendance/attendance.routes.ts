import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { bulkMarkAttendance, getAttendance, getAttendanceSummary } from "./attendance.controller";
import kioskRoutes from "./kiosk.routes";

const router = Router();

/* =========================================================
   KIOSK SUB-MODULE (RFID/NFC card + fingerprint gate kiosk)
   Mounted here, BEFORE the blanket `router.use(tenantMiddleware,
   authMiddleware)` below, on purpose - same reasoning as why
   core/router.ts mounts /guardian before any "/"-root-mounted router.
   The kiosk scan endpoints (/kiosk/scan-card, /kiosk/scan-fingerprint)
   authenticate via a device API key (kioskDeviceAuth), never an admin
   JWT - the gate kiosk has no logged-in admin user. kioskRoutes is fully
   self-contained: it applies its own tenantMiddleware internally and its
   own explicit authMiddleware/rbacMiddleware("kiosk.manage") per-route for
   the admin-only device-management and card-assignment endpoints. If this
   were mounted after the line below instead, every kiosk request would be
   incorrectly forced through authMiddleware first and the scan endpoints
   would break.
========================================================= */
router.use("/kiosk", kioskRoutes);

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering attendance.* (see rbac-policy.ts), so neither
// gets locked out by these checks.

/* ================= ATTENDANCE ================= */
// Bulk-mark a whole class/day in one request (Student/Teacher/Staff share
// this same endpoint; `attendee_type` in the body picks which).
router.post("/bulk", rbacMiddleware("attendance.mark"), bulkMarkAttendance);

// List raw attendance rows for a date / date-range / class / attendee.
router.get("/", rbacMiddleware("attendance.read"), getAttendance);

// Monthly present/absent/late/leave summary + percentage for one attendee.
router.get("/summary", rbacMiddleware("attendance.read"), getAttendanceSummary);

export default router;
