import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getUsers,
  createUser,
  deleteUser,
  updateUser,
  resetUserPassword,
  unlockUserAccount,
} from "./user.controller";

const router = Router();

router.get("/", tenantMiddleware, authMiddleware, subscriptionCheck, rbacMiddleware("users.read"), getUsers);
router.post("/", tenantMiddleware, authMiddleware, subscriptionCheck, rbacMiddleware("users.create"), createUser);
router.patch("/:id", tenantMiddleware, authMiddleware, subscriptionCheck, rbacMiddleware("users.update"), updateUser);
router.post(
  "/:id/reset-password",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("users.update"),
  resetUserPassword,
);
router.post(
  "/:id/unlock",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("users.update"),
  unlockUserAccount,
);
router.delete("/:id", tenantMiddleware, authMiddleware, subscriptionCheck, rbacMiddleware("users.delete"), deleteUser);

export default router;
