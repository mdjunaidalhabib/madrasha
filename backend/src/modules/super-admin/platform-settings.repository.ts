import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class PlatformSettingsRepository {
  findCloudinaryConfig() {
    // True singleton - always at most one row, so "first" is "the" config.
    return prisma.platformCloudinaryConfig.findFirst({ orderBy: { id: "asc" } });
  }

  async upsertCloudinaryConfig(data: {
    cloudName: string;
    apiKey: string;
    apiSecretEnc: string;
  }) {
    const existing = await this.findCloudinaryConfig();
    if (existing) {
      return prisma.platformCloudinaryConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.platformCloudinaryConfig.create({ data: data as Prisma.PlatformCloudinaryConfigUncheckedCreateInput });
  }

  async deleteCloudinaryConfig() {
    const existing = await this.findCloudinaryConfig();
    if (!existing) return { count: 0 };
    return prisma.platformCloudinaryConfig.deleteMany({ where: { id: existing.id } });
  }

  findSmsConfig() {
    return prisma.platformSmsConfig.findFirst({ orderBy: { id: "asc" } });
  }

  async upsertSmsConfig(data: Prisma.PlatformSmsConfigUncheckedCreateInput) {
    const existing = await this.findSmsConfig();
    if (existing) {
      return prisma.platformSmsConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.platformSmsConfig.create({ data });
  }

  async deleteSmsConfig() {
    const existing = await this.findSmsConfig();
    if (!existing) return { count: 0 };
    return prisma.platformSmsConfig.deleteMany({ where: { id: existing.id } });
  }

  findEmailConfig() {
    return prisma.platformEmailConfig.findFirst({ orderBy: { id: "asc" } });
  }

  async upsertEmailConfig(data: Prisma.PlatformEmailConfigUncheckedCreateInput) {
    const existing = await this.findEmailConfig();
    if (existing) {
      return prisma.platformEmailConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.platformEmailConfig.create({ data });
  }

  async deleteEmailConfig() {
    const existing = await this.findEmailConfig();
    if (!existing) return { count: 0 };
    return prisma.platformEmailConfig.deleteMany({ where: { id: existing.id } });
  }
}

export const platformSettingsRepository = new PlatformSettingsRepository();
