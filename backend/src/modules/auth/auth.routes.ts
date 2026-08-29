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
  refreshAccessToken,
  logout,
  logoutAllDevices,
  revokeSession,
  listSessions,
} from "./auth.controller";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { idParamSchema } from "../../shared/validators/common.validation";
import {
  loginSchema,
  unlockSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateMeSchema,
  changeMyPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  logoutAllSchema,
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

/* REFRESH / LOGOUT - same stricter pre-auth rate limit as password reset:
   /refresh and /logout are called with just a refresh token, no password. */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

router.post(
  "/refresh",
  refreshLimiter,
  tenantMiddleware,
  validate(refreshTokenSchema),
  refreshAccessToken,
);
router.post("/logout", refreshLimiter, tenantMiddleware, validate(logoutSchema), logout);

/* LOGOUT FROM ALL DEVICES - body.keep_current=true revokes every OTHER
   session and leaves this one signed in; omitted/false revokes this one too. */
router.post(
  "/logout-all",
  tenantMiddleware,
  authMiddleware,
  validate(logoutAllSchema),
  logoutAllDevices,
);

/* ACTIVE SESSIONS - device list shown on the profile page. */
router.get("/sessions", tenantMiddleware, authMiddleware, listSessions);
router.delete(
  "/sessions/:id",
  tenantMiddleware,
  authMiddleware,
  validate(idParamSchema),
  revokeSession,
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
