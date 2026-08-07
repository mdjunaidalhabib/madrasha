import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  unlockScreen,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changeMyPassword,
} from "./auth.controller";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  loginSchema,
  unlockSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateMeSchema,
  changeMyPasswordSchema,
} from "./auth.validation";

const router = Router();

/* LOGIN - rate-limited per IP in addition to the account-level lockout
   in AuthService.login() (see MAX_FAILED_LOGIN_ATTEMPTS). The IP limit
   catches credential-stuffing across many different accounts; the
   account lockout catches repeated guesses against one account. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, tenantMiddleware, validate(loginSchema), login);

/* UNLOCK SCREEN */
router.post("/unlock", tenantMiddleware, authMiddleware, validate(unlockSchema), unlockScreen);

/* FORGOT / RESET PASSWORD - stricter rate limit since these are
   pre-auth, abuse-prone endpoints (email enumeration / token guessing). */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

router.post(
  "/forgot-password",
  passwordResetLimiter,
  tenantMiddleware,
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  "/reset-password",
  passwordResetLimiter,
  tenantMiddleware,
  validate(resetPasswordSchema),
  resetPassword,
);

/* MY PROFILE - any authenticated user manages their own account here,
   deliberately without rbacMiddleware("users.*") since that permission
   only covers admins managing OTHER users (see users module). */
router.get("/me", tenantMiddleware, authMiddleware, getMe);
router.patch("/me", tenantMiddleware, authMiddleware, validate(updateMeSchema), updateMe);
router.post(
  "/change-password",
  tenantMiddleware,
  authMiddleware,
  validate(changeMyPasswordSchema),
  changeMyPassword,
);

export default router;
