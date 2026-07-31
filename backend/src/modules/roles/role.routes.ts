import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { getRoles, getPermissionCatalog, createRole, updateRole, deleteRole } from "./role.controller";

// NOTE: this router is mounted at "/" (see core/router.ts), not "/roles",
// because it needs to expose both /roles and /permissions.
const router = Router();

const guard = [tenantMiddleware, authMiddleware, rbacMiddleware("roles.manage")];

router.get("/roles", ...guard, getRoles);
router.post("/roles", ...guard, createRole);
router.put("/roles/:id", ...guard, updateRole);
router.delete("/roles/:id", ...guard, deleteRole);

// Read-only reference data for building the permission matrix UI.
router.get("/permissions", ...guard, getPermissionCatalog);

export default router;
