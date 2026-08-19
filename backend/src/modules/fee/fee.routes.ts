import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  generateInvoices,
  getInvoices,
  getPendingInvoices,
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
router.post("/invoices/generate", rbacMiddleware("fee.manage"), generateInvoices);
// Bulk version of generate: runs auto-billing for every currently-enrolled
// student instead of one class/month at a time - for backfilling students
// admitted before auto-billing-at-admission existed.
router.post("/invoices/backfill", rbacMiddleware("fee.manage"), backfillInvoices);
router.get("/invoices", rbacMiddleware("fee.read"), getInvoices);
// Registered as its own literal path (not GET /invoices/:id) - backs the
// dedicated "ভর্তি ফি পেন্ডিং" sidebar page.
router.get("/invoices/pending", rbacMiddleware("fee.read"), getPendingInvoices);
router.post("/invoices/:id/pay", rbacMiddleware("fee.collect_payment"), payInvoice);
// Deliberately named "invoice.waive", NOT "fee.waive" - isAccountsPermission()
// in rbac-policy.ts grants every "fee.*" permission wholesale to ACCOUNTANT,
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
