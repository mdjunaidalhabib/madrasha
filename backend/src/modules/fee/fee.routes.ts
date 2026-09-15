import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getFeeStructures,
  getFeeStructureExams,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getFeeCategories,
  createFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
  getInvoices,
  getOverdueFees,
  getPendingInvoices,
  getInvoiceSummary,
  clearPendingInvoices,
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
// Registered as its own literal path (not GET /fee-structures/:id) - backs
// the "যুক্ত পরীক্ষা" picker without requiring exam.read (see fee.controller.ts).
router.get("/fee-structures/exams", rbacMiddleware("fee.read"), getFeeStructureExams);
router.post("/fee-structures", rbacMiddleware("fee.manage"), createFeeStructure);
router.put("/fee-structures/:id", rbacMiddleware("fee.manage"), updateFeeStructure);
router.delete("/fee-structures/:id", rbacMiddleware("fee.manage"), deleteFeeStructure);

/* ================= ফি ধরণ ব্যবস্থাপনা (settings CRUD) ================= */
router.get("/fee-categories", rbacMiddleware("fee.read"), getFeeCategories);
router.post("/fee-categories", rbacMiddleware("fee.manage"), createFeeCategory);
router.patch("/fee-categories/:id", rbacMiddleware("fee.manage"), updateFeeCategory);
router.delete("/fee-categories/:id", rbacMiddleware("fee.manage"), deleteFeeCategory);

/* ================= INVOICES ================= */
// Runs auto-billing for every currently-enrolled student in a class/session -
// for backfilling students admitted before auto-billing-at-admission
// existed, and called automatically right after a fee structure is created.
router.post("/invoices/backfill", rbacMiddleware("fee.manage"), backfillInvoices);
router.get("/invoices", rbacMiddleware("fee.read"), getInvoices);
// Backs the dedicated "বকেয়া ফী" management page - every overdue invoice
// across every fee type, grouped per student.
router.get("/invoices/overdue", rbacMiddleware("fee.read"), getOverdueFees);
// Registered as its own literal path (not GET /invoices/:id) - backs the
// dedicated "ভর্তি ফি পেন্ডিং" sidebar page.
router.get("/invoices/pending", rbacMiddleware("fee.read"), getPendingInvoices);
// Aggregate stats for the ফি ব্যবস্থাপনা module dashboard.
router.get("/invoices/summary", rbacMiddleware("fee.read"), getInvoiceSummary);
// "সব ক্লিয়ার করুন" on that page - fee.manage (not fee.read) since it mutates
// every currently-pending row, even though it's non-destructive.
router.post("/invoices/pending/clear", rbacMiddleware("fee.manage"), clearPendingInvoices);
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
