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
        brandingPhones: true,
        brandingEmails: true,
        reportLogo: true,
        reportBanner: true,
        reportWatermark: true,
        reportWatermarkOpacity: true,
        reportHeaderFooterEnabled: true,
        reportHeaderText: true,
        reportFooterText: true,
        reportPrintMode: true,
      },
    });
  }

  updateBranding(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  updateField(madrasaId: number, field: "reportLogo" | "reportBanner" | "reportWatermark", value: null) {
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

  findIdCardDesign(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { idCardDesign: true, idCardBackgroundImage: true },
    });
  }

  updateIdCardDesign(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  findAdmitCardDesign(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { admitCardDesign: true, admitCardBackgroundImage: true },
    });
  }

  updateAdmitCardDesign(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  findLetterDesign(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { letterDesign: true, letterBackgroundImage: true },
    });
  }

  updateLetterDesign(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  findBookLabelDesign(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { bookLabelDesign: true, bookLabelBackgroundImage: true },
    });
  }

  updateBookLabelDesign(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  findMadrasaLimits(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { studentLimit: true, userLimit: true, planStatus: true },
    });
  }

  /** Current plan comes from the latest active subscription row - see
   * assignPlanToMadrasa in superadmin.service.ts, which is the only place
   * this row is created/replaced (fully super-admin controlled). */
  findActiveSubscription(madrasaId: number) {
    return prisma.madrasaSubscription.findFirst({
      where: { madrasaId, isActive: 1 },
      orderBy: { id: "desc" },
      select: {
        startDate: true,
        endDate: true,
        plan: { select: { name: true, price: true, durationDays: true } },
      },
    });
  }

  countActiveStudents(madrasaId: number) {
    return prisma.student.count({ where: { madrasaId, isActive: 1, deletedAt: null } });
  }

  countActiveUsers(madrasaId: number) {
    return prisma.user.count({ where: { madrasaId, isActive: 1 } });
  }

  findSectionToggles(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { settingsSectionToggles: true },
    });
  }

  updateSectionToggles(madrasaId: number, toggles: Record<string, boolean>) {
    return prisma.madrasa.update({
      where: { id: madrasaId },
      data: { settingsSectionToggles: toggles },
    });
  }
}

export const settingsRepository = new SettingsRepository();
