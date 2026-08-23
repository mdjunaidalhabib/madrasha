import { Router } from "express";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";
import {
  listPackagesAdmin,
  createPackageAdmin,
  updatePackageAdmin,
  togglePackageAdmin,
  deletePackageAdmin,
  getPricingAdmin,
  setPricingAdmin,
  setPricingOverrideAdmin,
  deletePricingOverrideAdmin,
  listPurchaseRequestsAdmin,
  approvePurchaseRequestAdmin,
  rejectPurchaseRequestAdmin,
  manualAdjustCreditAdmin,
  getMadrasaSubscriptionsAdmin,
  getMadrasaUsageAdmin,
  getMadrasaTransactionsAdmin,
  getReportAdmin,
} from "./billing-admin.controller";

const router = Router();

/* =====================================================
   MESSAGE PACKAGES (SMS/Email, channel-discriminated)
   Base: /api/super/message-billing/packages
===================================================== */
router.get("/packages", superAdminMiddleware, listPackagesAdmin);
router.post("/packages", superAdminMiddleware, createPackageAdmin);
router.put("/packages/:id", superAdminMiddleware, updatePackageAdmin);
router.patch("/packages/:id/toggle", superAdminMiddleware, togglePackageAdmin);
router.delete("/packages/:id", superAdminMiddleware, deletePackageAdmin);

/* =====================================================
   PRICING (global default + per-madrasa override)
===================================================== */
router.get("/pricing", superAdminMiddleware, getPricingAdmin);
router.put("/pricing/:channel", superAdminMiddleware, setPricingAdmin);
router.put("/pricing/:channel/madrasas/:madrasaId", superAdminMiddleware, setPricingOverrideAdmin);
router.delete("/pricing/:channel/madrasas/:madrasaId", superAdminMiddleware, deletePricingOverrideAdmin);

/* =====================================================
   PURCHASE REQUESTS (manual approval flow)
===================================================== */
router.get("/purchase-requests", superAdminMiddleware, listPurchaseRequestsAdmin);
router.post("/purchase-requests/:id/approve", superAdminMiddleware, approvePurchaseRequestAdmin);
router.post("/purchase-requests/:id/reject", superAdminMiddleware, rejectPurchaseRequestAdmin);

/* =====================================================
   MANUAL CREDIT / DEDUCTION
===================================================== */
router.post("/madrasas/:madrasaId/manual-credit", superAdminMiddleware, manualAdjustCreditAdmin);

/* =====================================================
   TENANT VIEW (support) + REPORTING
===================================================== */
router.get("/madrasas/:madrasaId/subscriptions", superAdminMiddleware, getMadrasaSubscriptionsAdmin);
router.get("/madrasas/:madrasaId/usage", superAdminMiddleware, getMadrasaUsageAdmin);
router.get("/madrasas/:madrasaId/transactions", superAdminMiddleware, getMadrasaTransactionsAdmin);
router.get("/reports", superAdminMiddleware, getReportAdmin);

export default router;
