import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { createIncome, createExpense, getReport, getAccountOptions } from "./account.controller";

const router = Router();

router.get(
  "/options",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.read"),
  getAccountOptions,
);
router.post(
  "/income",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.create"),
  createIncome,
);
router.post(
  "/expense",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.create"),
  createExpense,
);
router.get(
  "/report",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.read"),
  getReport,
);

export default router;
