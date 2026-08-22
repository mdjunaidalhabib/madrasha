import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { getSessions, createSession, updateSession, setCurrentSession, deleteSession } from "./session.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Permission keys use the "students." prefix (not a new "session." prefix)
// to group with the rest of student management. Seeded into TALIMAT's
// default grant (see TALIMAT_DEFAULT_PERMISSION_KEYS in
// shared/permissions/baseline-role-permissions.ts). MUHTAMIM/SUPER_ADMIN
// bypass rbacMiddleware entirely.
router.get("/", rbacMiddleware("students.session_read"), getSessions);
router.post("/", rbacMiddleware("students.session_manage"), createSession);
router.put("/:id", rbacMiddleware("students.session_manage"), updateSession);
router.patch("/:id/set-current", rbacMiddleware("students.session_manage"), setCurrentSession);
router.delete("/:id", rbacMiddleware("students.session_manage"), deleteSession);

export default router;
