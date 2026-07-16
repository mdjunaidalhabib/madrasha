import { prisma } from "../../shared/database/prisma";

export class SuperAdminAuthRepository {
  findActiveByEmail(email: string) {
    return prisma.superAdmin.findFirst({ where: { email, isActive: 1 } });
  }
}

export const superAdminAuthRepository = new SuperAdminAuthRepository();
