import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import {
  isSuperAdminRole,
  normalizeAppRole,
  isMuhtamimRole,
  hasFallbackRole,
  isRoleBasedPermission,
} from "../permissions";

async function getUserRole(req: Request) {
  const directRole = (req.user as any)?.role || (req.user as any)?.role_name;
  if (directRole) return normalizeAppRole(directRole);

  const roleId = req.user?.role_id;
  if (!roleId) return "";

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { keyName: true, nameBn: true },
  });

  return normalizeAppRole(role?.keyName || role?.nameBn || "");
}

async function getRolePermissions(roleId: number) {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { keyName: true } } },
  });

  return rows.map((r) => r.permission.keyName).filter((k): k is string => Boolean(k));
}

export const requireRole = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const role = await getUserRole(req);
      const allowedRoles = roles.map(normalizeAppRole);

      if (
        isSuperAdminRole(role) ||
        isMuhtamimRole(role) ||
        allowedRoles.includes(normalizeAppRole(role))
      ) {
        return next();
      }

      return res.status(403).json({ message: "Forbidden: insufficient role" });
    } catch (error) {
      return next(error);
    }
  };
};

export const rbacMiddleware = (permission: string) => requirePermission(permission);

export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = req.user?.role_id;

      if (!req.user || !roleId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const role = await getUserRole(req);

      if (isSuperAdminRole(role) || isMuhtamimRole(role)) {
        return next();
      }

      const appRole = normalizeAppRole(role);
      const roleBasedAllowed = isRoleBasedPermission(appRole, permission);

      const perms = await getRolePermissions(Number(roleId));

      if (!perms.includes(permission) && !hasFallbackRole(permission, role) && !roleBasedAllowed) {
        return res.status(403).json({ message: "Forbidden: missing permission" });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const requireAnyPermission = (...permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = req.user?.role_id;

      if (!req.user || !roleId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const role = await getUserRole(req);

      if (isSuperAdminRole(role) || isMuhtamimRole(role)) {
        return next();
      }

      const appRole = normalizeAppRole(role);
      const perms = await getRolePermissions(Number(roleId));
      const hasPermission = permissions.some((permission) => perms.includes(permission));

      const hasFallbackPermission = permissions.some((permission) =>
        hasFallbackRole(permission, role),
      );
      const hasRoleBasedPermission = permissions.some((permission) =>
        isRoleBasedPermission(appRole, permission),
      );

      if (!hasPermission && !hasFallbackPermission && !hasRoleBasedPermission) {
        return res.status(403).json({ message: "Forbidden: missing permission" });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export const requireTenantOwnership = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userMadrasaId = Number(req.user.madrasa_id);
    const tenantMadrasaId = Number(req.tenant?.madrasa_id);

    if (!tenantMadrasaId || !userMadrasaId || userMadrasaId !== tenantMadrasaId) {
      return res.status(403).json({ message: "Forbidden: invalid madrasa access" });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
