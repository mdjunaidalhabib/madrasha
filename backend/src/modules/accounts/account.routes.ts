import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  createIncome,
  createExpense,
  getReport,
  getAccountOptions,
  listAccounts,
  updateAccount,
  deleteAccount,
} from "./account.controller";

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
router.get(
  "/",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.read"),
  listAccounts,
);
router.patch(
  "/:id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.update"),
  updateAccount,
);
router.delete(
  "/:id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.delete"),
  deleteAccount,
);

export default router;
