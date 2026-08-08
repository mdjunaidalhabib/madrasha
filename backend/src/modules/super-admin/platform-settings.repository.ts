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
}

export const platformSettingsRepository = new PlatformSettingsRepository();
