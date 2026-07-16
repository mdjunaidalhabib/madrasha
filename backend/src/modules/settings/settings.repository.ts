import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class SettingsRepository {
  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1 },
      select: { division: { select: { id: true, nameBn: true } } },
      orderBy: { division: { id: "asc" } },
    });
  }

  findActiveClassesByDivision(madrasaId: number, divisionId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, isActive: 1, class: { divisionId } },
      select: { class: { select: { id: true, nameBn: true } } },
      orderBy: { class: { id: "asc" } },
    });
  }

  findBranding(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: {
        name: true,
        address: true,
        reportLogo: true,
        reportWatermark: true,
        reportWatermarkOpacity: true,
      },
    });
  }

  updateBranding(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  updateField(madrasaId: number, field: "reportLogo" | "reportWatermark", value: null) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data: { [field]: value } });
  }

  findDocumentTemplates(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: {
        sanadTemplate: true,
        testimonialTemplate: true,
        transferLetterTemplate: true,
        admitCardRules: true,
      },
    });
  }

  updateDocumentTemplates(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }
}

export const settingsRepository = new SettingsRepository();
