import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class RoleRepository {
  findRolesForTenant(madrasaId: number) {
    return prisma.role.findMany({
      where: { madrasaId },
      orderBy: { id: "asc" },
      include: {
        rolePermissions: { include: { permission: { select: { keyName: true, name: true } } } },
        _count: { select: { users: true } },
      },
    });
  }

  findRoleForTenant(id: number, madrasaId: number) {
    return prisma.role.findFirst({ where: { id, madrasaId } });
  }

  findRoleByKeyForTenant(madrasaId: number, keyName: string) {
    return prisma.role.findFirst({ where: { madrasaId, keyName } });
  }

  findAllPermissions() {
    return prisma.permission.findMany({ orderBy: { keyName: "asc" } });
  }

  findPermissionIdsByKeys(keys: string[]) {
    return prisma.permission.findMany({
      where: { keyName: { in: keys } },
      select: { id: true, keyName: true },
    });
  }

  createRoleOnTx(tx: TransactionClient, madrasaId: number, keyName: string, nameBn: string) {
    return tx.role.create({ data: { madrasaId, keyName, nameBn } });
  }

  setRolePermissionsOnTx(tx: TransactionClient, roleId: number, permissionIds: number[]) {
    return Promise.all([
      tx.rolePermission.deleteMany({ where: { roleId } }),
      permissionIds.length
        ? tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
    ]);
  }

  updateRoleNameOnTx(tx: TransactionClient, id: number, nameBn: string) {
    return tx.role.update({ where: { id }, data: { nameBn } });
  }

  deleteRoleForTenant(id: number, madrasaId: number) {
    return prisma.role.deleteMany({ where: { id, madrasaId } });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const roleRepository = new RoleRepository();
