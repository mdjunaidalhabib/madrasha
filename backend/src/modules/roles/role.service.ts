import crypto from "crypto";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { DEFAULT_ROLE_PERMISSION_KEYS, isMuhtamimRole, normalizeAppRole } from "../../shared/permissions";
import { roleRepository, RoleRepository } from "./role.repository";
import { CreateRoleRequestDto, UpdateRoleRequestDto } from "./role.dto";
import { PROTECTED_ROLE_KEYS } from "./role.constants";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

/** Best-effort ASCII key derived from a (often Bengali) display name;
 * falls back to a random suffix when nothing ASCII survives, so every
 * role still gets a usable, unique key_name. */
const deriveKeyName = (nameBn: string) => {
  const ascii = nameBn
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ascii || `ROLE_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

export class RoleService {
  constructor(private readonly repository: RoleRepository = roleRepository) {}

  async listRoles(madrasaId: number) {
    try {
      const roles = await this.repository.findRolesForTenant(madrasaId);
      return roles.map((role) => ({
        id: role.id,
        key_name: role.keyName,
        name_bn: role.nameBn,
        is_protected: PROTECTED_ROLE_KEYS.includes(role.keyName || ""),
        user_count: role._count.users,
        permission_keys: role.rolePermissions
          .map((rp) => rp.permission.keyName)
          .filter((k): k is string => Boolean(k)),
      }));
    } catch (err) {
      return friendlyFailure("listRoles error:", err, "Failed to load roles");
    }
  }

  async listPermissionCatalog() {
    try {
      return await this.repository.findAllPermissions();
    } catch (err) {
      return friendlyFailure("listPermissionCatalog error:", err, "Failed to load permissions");
    }
  }

  async createRole(madrasaId: number, dto: CreateRoleRequestDto) {
    if (!dto.name_bn || !dto.name_bn.trim()) {
      throw new BadRequestError("name_bn is required");
    }

    // "তালিমাত"/"হিসাবরক্ষক" are no longer provisioned for every madrasa, so
    // when one is created here it must get its built-in key - TALIMAT's
    // exam-department authority (rbac-policy.ts) is keyed on it.
    const builtinKey = normalizeAppRole(dto.key_name || dto.name_bn);
    const isBuiltin = Object.prototype.hasOwnProperty.call(DEFAULT_ROLE_PERMISSION_KEYS, builtinKey);

    let keyName = isBuiltin ? builtinKey : dto.key_name?.trim().toUpperCase() || deriveKeyName(dto.name_bn);
    const existing = await this.repository.findRoleByKeyForTenant(madrasaId, keyName);
    if (existing) {
      if (isBuiltin) throw new ConflictError("এই রোলটি আগে থেকেই আছে");
      // Auto-disambiguate rather than fail outright on an auto-derived key.
      keyName = `${keyName}_${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    }

    const permissionKeys = dto.permission_keys?.length
      ? dto.permission_keys
      : isBuiltin
        ? DEFAULT_ROLE_PERMISSION_KEYS[builtinKey]
        : [];

    try {
      return await this.repository.runTransaction(async (tx) => {
        const role = await this.repository.createRoleOnTx(tx, madrasaId, keyName, dto.name_bn.trim());

        if (permissionKeys.length) {
          const permissions = await this.repository.findPermissionIdsByKeys(permissionKeys);
          await this.repository.setRolePermissionsOnTx(
            tx,
            role.id,
            permissions.map((p) => p.id),
          );
        }

        return { id: role.id, key_name: role.keyName };
      });
    } catch (err) {
      return friendlyFailure("createRole error:", err, "Failed to create role");
    }
  }

  async updateRole(id: number, madrasaId: number, dto: UpdateRoleRequestDto) {
    const role = await this.repository.findRoleForTenant(id, madrasaId);
    if (!role) throw new NotFoundError("Role not found");

    // MUHTAMIM bypasses every permission check regardless of what's stored
    // in role_permissions (see isMuhtamimRole in rbac.middleware.ts) - its
    // rows exist only so the Roles & Permissions UI shows an accurate "all
    // permissions" count, not so they can be edited. Changing them here
    // would silently do nothing, which is worse than just refusing.
    if (dto.permission_keys !== undefined && isMuhtamimRole(role.keyName || "")) {
      throw new ConflictError(
        "মুহতামিম সবসময় সম্পূর্ণ অ্যাক্সেস পাবেন — এই রোলের পারমিশন পরিবর্তন করা যাবে না।",
      );
    }

    try {
      await this.repository.runTransaction(async (tx) => {
        if (dto.name_bn !== undefined && dto.name_bn.trim()) {
          await this.repository.updateRoleNameOnTx(tx, id, dto.name_bn.trim());
        }
        if (dto.permission_keys !== undefined) {
          const permissions = await this.repository.findPermissionIdsByKeys(dto.permission_keys);
          await this.repository.setRolePermissionsOnTx(
            tx,
            id,
            permissions.map((p) => p.id),
          );
        }
      });
    } catch (err) {
      return friendlyFailure("updateRole error:", err, "Failed to update role");
    }
  }

  async deleteRole(id: number, madrasaId: number) {
    const role = await this.repository.findRoleForTenant(id, madrasaId);
    if (!role) throw new NotFoundError("Role not found");

    if (PROTECTED_ROLE_KEYS.includes(role.keyName || "")) {
      throw new ConflictError(
        "This is a default system role and can't be deleted (its key is relied on elsewhere)",
      );
    }

    const roles = await this.repository.findRolesForTenant(madrasaId);
    const target = roles.find((r) => r.id === id);
    if (target && target._count.users > 0) {
      throw new ConflictError(
        `Can't delete this role while ${target._count.users} user(s) are still assigned to it`,
      );
    }

    try {
      const result = await this.repository.deleteRoleForTenant(id, madrasaId);
      if (!result.count) throw new NotFoundError("Role not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteRole error:", err, "Failed to delete role");
    }
  }
}

export const roleService = new RoleService();
