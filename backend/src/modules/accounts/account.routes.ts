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
  listFunds,
  createFund,
  updateFund,
  deleteFund,
  createCategory,
  updateCategory,
  deleteCategory,
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

/* ================= ফান্ড ও খাত ব্যবস্থাপনা (settings CRUD) ================= */

router.get(
  "/funds",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.read"),
  listFunds,
);
router.post(
  "/funds",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.create"),
  createFund,
);
router.patch(
  "/funds/:id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.update"),
  updateFund,
);
router.delete(
  "/funds/:id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.delete"),
  deleteFund,
);
router.post(
  "/funds/:fundId/categories",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.create"),
  createCategory,
);
router.patch(
  "/categories/:id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.update"),
  updateCategory,
);
router.delete(
  "/categories/:id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("accounts.delete"),
  deleteCategory,
);

export default router;
