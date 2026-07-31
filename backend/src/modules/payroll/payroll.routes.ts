import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { generatePayroll, getPayroll, markPayrollPaid } from "./payroll.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.post("/generate", rbacMiddleware("payroll.manage"), generatePayroll);
router.get("/", rbacMiddleware("payroll.read"), getPayroll);
router.patch("/:id/pay", rbacMiddleware("payroll.manage"), markPayrollPaid);

export default router;
