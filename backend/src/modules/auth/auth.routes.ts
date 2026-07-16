import { Router } from "express";
import { login, unlockScreen } from "./auth.controller";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { loginSchema, unlockSchema } from "./auth.validation";

const router = Router();

/* LOGIN */
router.post("/login", tenantMiddleware, validate(loginSchema), login);

/* UNLOCK SCREEN */
router.post("/unlock", tenantMiddleware, authMiddleware, validate(unlockSchema), unlockScreen);

export default router;
