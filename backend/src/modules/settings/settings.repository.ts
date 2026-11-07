import { TransactionClient } from "../../shared/database/transaction";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class SettingsRepository {
  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1 },
      select: { nameBn: true, division: { select: { id: true, nameBn: true, name: true } } },
      // This madrasa's own serial (তালিমাত সেটিংসে সাজানো ক্রম), not the global id.
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findActiveClassesByDivision(madrasaId: number, divisionId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, isActive: 1, class: { divisionId } },
      select: { nameBn: true, class: { select: { id: true, nameBn: true, name: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
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
        brandingSocialLinks: true,
        reportLogo: true,
        reportBanner: true,
        reportWatermark: true,
        reportWatermarkOpacity: true,
        reportHeaderFooterEnabled: true,
        reportHeaderImage: true,
        reportFooterImage: true,
        reportPrintMode: true,
        reportBrandLayout: true,
        marksheetFieldLayout: true,
        admitCardFieldLayout: true,
      },
    });
  }

  updateBranding(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  updateField(
    madrasaId: number,
    field: "reportLogo" | "reportBanner" | "reportWatermark" | "reportHeaderImage" | "reportFooterImage",
    value: null,
  ) {
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
        customNoticeTemplate: true,
      },
    });
  }

  updateDocumentTemplates(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.update({ where: { id: madrasaId }, data });
  }

  findIdCardBack(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { idCardBackSettings: true },
    });
  }

  updateIdCardBack(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
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
      select: { studentLimit: true, userLimit: true, planStatus: true, isActive: true },
    });
  }

  /** Latest subscription remains visible after cancellation so the plan page
   * can explain suspension and show payment/refund information. See
   * assignPlanToMadrasa in superadmin.service.ts, which is the only place
   * this row is created/replaced (fully super-admin controlled). */
  findActiveSubscription(madrasaId: number) {
    return prisma.madrasaSubscription.findFirst({
      where: { madrasaId },
      orderBy: { id: "desc" },
      select: {
        id: true, isActive: true, pricePaid: true, cancelledAt: true, refundedAt: true,
        payments: { where: { status: "paid" }, select: { amount: true } },
        cycle: true,
        startDate: true,
        endDate: true,
        plan: true,
      },
    });
  }

  findFirstSubscription(madrasaId: number) {
    return prisma.madrasaSubscription.findFirst({ where: { madrasaId }, orderBy: { id: "asc" }, select: { id: true } });
  }

  findDomainSubscription(madrasaId: number) {
    return prisma.madrasaDomainSubscription.findFirst({ where: { madrasaId }, orderBy: { id: "desc" } });
  }

  findSubscriptionPayments(madrasaId: number) {
    return prisma.subscriptionPayment.findMany({ where: { madrasaId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10,
      select: { amount: true, paymentMethod: true, status: true, createdAt: true } });
  }

  findAvailablePricingPlans() {
    return prisma.plan.findMany({ where: { isActive: 1, deletedAt: null }, orderBy: { studentLimit: "asc" } });
  }

  countActiveStudents(madrasaId: number, tx?: TransactionClient) {
    return (tx ?? prisma).student.count({ where: { madrasaId, isActive: 1, deletedAt: null } });
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
