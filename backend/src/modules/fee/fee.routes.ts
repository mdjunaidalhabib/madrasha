import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getInvoices,
  getPendingInvoices,
  clearPendingInvoices,
  deleteAllInvoices,
  backfillInvoices,
  payInvoice,
  waiveInvoice,
  getPaymentMethodSettings,
  createPaymentMethodSetting,
  updatePaymentMethodSetting,
  deletePaymentMethodSetting,
} from "./fee.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// shared/permissions/rbac-policy.ts), so this never locks out the
// primary admin - it only restricts other, non-default roles.

/* ================= FEE STRUCTURE ================= */
router.get("/fee-structures", rbacMiddleware("fee.read"), getFeeStructures);
router.post("/fee-structures", rbacMiddleware("fee.manage"), createFeeStructure);
router.put("/fee-structures/:id", rbacMiddleware("fee.manage"), updateFeeStructure);
router.delete("/fee-structures/:id", rbacMiddleware("fee.manage"), deleteFeeStructure);

/* ================= INVOICES ================= */
// Runs auto-billing for every currently-enrolled student in a class/session -
// for backfilling students admitted before auto-billing-at-admission
// existed, and called automatically right after a fee structure is created.
router.post("/invoices/backfill", rbacMiddleware("fee.manage"), backfillInvoices);
router.get("/invoices", rbacMiddleware("fee.read"), getInvoices);
// Registered as its own literal path (not GET /invoices/:id) - backs the
// dedicated "ভর্তি ফি পেন্ডিং" sidebar page.
router.get("/invoices/pending", rbacMiddleware("fee.read"), getPendingInvoices);
// "সব ক্লিয়ার করুন" on that page - fee.manage (not fee.read) since it mutates
// every currently-pending row, even though it's non-destructive.
router.post("/invoices/pending/clear", rbacMiddleware("fee.manage"), clearPendingInvoices);
// Irreversible tenant-wide wipe (e.g. clearing test/demo invoices before
// real use) - deliberately NOT under the "fee.*" prefix (see the same
// reasoning on invoice.waive below) so ACCOUNTANT's default "fee.*" grant
// doesn't cover it; only MUHTAMIM/SUPER_ADMIN (who bypass rbacMiddleware)
// can call this.
router.post("/invoices/delete-all", rbacMiddleware("invoice.delete_all"), deleteAllInvoices);
router.post("/invoices/:id/pay", rbacMiddleware("fee.collect_payment"), payInvoice);
// Deliberately named "invoice.waive", NOT "fee.waive" - ACCOUNTANT's default
// grant (see ACCOUNTANT_DEFAULT_PERMISSION_KEYS in
// shared/permissions/baseline-role-permissions.ts) covers every "fee.*" key,
// which would defeat the point. With no fee.* prefix and nothing seeded for
// this key, only MUHTAMIM/SUPER_ADMIN (who bypass rbacMiddleware entirely)
// can waive a fee.
router.post("/invoices/:id/waive", rbacMiddleware("invoice.waive"), waiveInvoice);

/* ================= MANUAL PAYMENT METHOD SETUP ================= */
router.get("/payment-methods", rbacMiddleware("fee.read"), getPaymentMethodSettings);
router.post("/payment-methods", rbacMiddleware("fee.manage"), createPaymentMethodSetting);
router.put("/payment-methods/:id", rbacMiddleware("fee.manage"), updatePaymentMethodSetting);
router.delete("/payment-methods/:id", rbacMiddleware("fee.manage"), deletePaymentMethodSetting);

export default router;
