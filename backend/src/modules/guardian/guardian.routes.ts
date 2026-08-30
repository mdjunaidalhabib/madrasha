import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  guardianLogin,
  guardianChangePassword,
  getMyChildren,
  getChildAttendance,
  getChildResults,
  getChildFees,
  getChildLibrary,
  getChildPromotion,
  getChildProfile360,
  getNotices,
} from "./guardian.controller";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { guardianAuthMiddleware } from "../../shared/middleware/guardianAuth.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { guardianLoginSchema, guardianChangePasswordSchema } from "./guardian.validation";

const router = Router();

/* LOGIN - rate-limited per IP, same reasoning as auth.routes.ts's
   loginLimiter (the guardian's own account-level lockout, see
   GuardianService.login, catches repeated guesses against one account). */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, tenantMiddleware, validate(guardianLoginSchema), guardianLogin);

router.post(
  "/change-password",
  tenantMiddleware,
  guardianAuthMiddleware,
  validate(guardianChangePasswordSchema),
  guardianChangePassword,
);

router.get("/me/children", tenantMiddleware, guardianAuthMiddleware, getMyChildren);
router.get("/students/:studentId/attendance", tenantMiddleware, guardianAuthMiddleware, getChildAttendance);
router.get("/students/:studentId/results", tenantMiddleware, guardianAuthMiddleware, getChildResults);
router.get("/students/:studentId/fees", tenantMiddleware, guardianAuthMiddleware, getChildFees);
router.get("/students/:studentId/library", tenantMiddleware, guardianAuthMiddleware, getChildLibrary);
router.get("/students/:studentId/promotion", tenantMiddleware, guardianAuthMiddleware, getChildPromotion);
router.get("/students/:studentId/profile-360", tenantMiddleware, guardianAuthMiddleware, getChildProfile360);
router.get("/notices", tenantMiddleware, guardianAuthMiddleware, getNotices);

export default router;
