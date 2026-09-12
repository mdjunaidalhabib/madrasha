import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware, requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { getSeatAllocations, autoAllocateSeats, manualAdjustSeat, clearSeatAllocations } from "./exam-seat.controller";
import { autoAllocateSeatsSchema, manualAdjustSeatSchema, clearSeatAllocationsSchema } from "./exam-seat.validation";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// A view-only exam.seat.read role can list seat allocations without
// holding exam.seat.manage (which stays required for every mutation below).
router.get("/", requireAnyPermission("exam.seat.read", "exam.seat.manage"), getSeatAllocations);
router.post("/allocate", rbacMiddleware("exam.seat.manage"), validate(autoAllocateSeatsSchema), autoAllocateSeats);
router.post("/clear", rbacMiddleware("exam.seat.manage"), validate(clearSeatAllocationsSchema), clearSeatAllocations);
router.put("/:id", rbacMiddleware("exam.seat.manage"), validate(manualAdjustSeatSchema), manualAdjustSeat);

export default router;
