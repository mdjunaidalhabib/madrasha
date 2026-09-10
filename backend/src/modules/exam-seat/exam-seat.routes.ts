import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { getSeatAllocations, autoAllocateSeats, manualAdjustSeat, clearSeatAllocations } from "./exam-seat.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// The task spec defines no separate exam.seat.read key, so listing also
// requires exam.seat.manage.
router.get("/", rbacMiddleware("exam.seat.manage"), getSeatAllocations);
router.post("/allocate", rbacMiddleware("exam.seat.manage"), autoAllocateSeats);
router.post("/clear", rbacMiddleware("exam.seat.manage"), clearSeatAllocations);
router.put("/:id", rbacMiddleware("exam.seat.manage"), manualAdjustSeat);

export default router;
