import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { kioskDeviceAuth } from "./kiosk.middleware";
import {
  scanCard,
  scanFingerprint,
  createDevice,
  listDevices,
  setDeviceActive,
  deleteDevice,
  assignStudentCard,
} from "./kiosk.controller";

const router = Router();

router.use(tenantMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware. kiosk.manage is
// deliberately NOT given a TALIMAT fallback in rbac-policy.ts - a leaked
// kiosk device key lets anyone mark arbitrary attendance, so device
// management stays least-privilege (MUHTAMIM/SUPER_ADMIN only) unless a
// role is explicitly granted the permission.

/* ================= KIOSK SCAN ================= */
// The gate kiosk has no logged-in admin user - it authenticates with its
// own device API key (kioskDeviceAuth) instead of authMiddleware/JWT, the
// same separate-auth-track pattern guardian.routes.ts uses for guardians.
router.post("/scan-card", kioskDeviceAuth, scanCard);
router.post("/scan-fingerprint", kioskDeviceAuth, scanFingerprint);

/* ================= KIOSK DEVICE MANAGEMENT (admin) ================= */
router.post("/devices", authMiddleware, rbacMiddleware("kiosk.manage"), createDevice);
router.get("/devices", authMiddleware, rbacMiddleware("kiosk.manage"), listDevices);
router.patch("/devices/:id", authMiddleware, rbacMiddleware("kiosk.manage"), setDeviceActive);
router.delete("/devices/:id", authMiddleware, rbacMiddleware("kiosk.manage"), deleteDevice);

/* ================= STUDENT CARD ASSIGNMENT (admin) ================= */
// Assigning a card is part of kiosk administration, reuses kiosk.manage.
router.patch(
  "/students/:id/card",
  authMiddleware,
  rbacMiddleware("kiosk.manage"),
  assignStudentCard,
);

export default router;
