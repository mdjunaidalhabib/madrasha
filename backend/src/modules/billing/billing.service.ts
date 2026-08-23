import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { analyzeSmsContent } from "../../shared/utils/sms-segment.util";
import { billingRepository, BillingRepository } from "./billing.repository";
import { BillingChannel, BILLING_CHANNELS, PerformedByType, SubscriptionSummaryDto } from "./billing.types";
import {
  creditMessages,
  DEFAULT_PROVIDER_COST,
  DEFAULT_SELLING_PRICE,
  MANUAL_GRANT_DEFAULT_VALIDITY_DAYS,
} from "./billing.constants";

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const num = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export interface ChargeResult {
  usageLogId: number;
  encoding: "GSM_7" | "UNICODE" | null;
  characterCount: number | null;
  segmentCount: number;
  pricePerUnit: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  remainingCreditAfter: number;
}

export class BillingService {
  constructor(private readonly repository: BillingRepository = billingRepository) {}

  /* ================= TENANT-FACING READS ================= */

  listPackages(channel: BillingChannel) {
    return this.repository.findSellablePackages(channel);
  }

  private toSummaryDto(
    channel: BillingChannel,
    sub: Awaited<ReturnType<BillingRepository["findSubscription"]>>,
    lowCreditThreshold: number,
  ): SubscriptionSummaryDto {
    if (!sub) {
      return {
        channel,
        active: false,
        packageId: null,
        packageName: null,
        startDate: null,
        expiryDate: null,
        totalCredit: 0,
        usedCredit: 0,
        remainingCredit: 0,
        isLowCredit: false,
      };
    }
    const active = sub.status === "ACTIVE" && sub.expiryDate.getTime() >= Date.now();
    return {
      channel,
      active,
      packageId: sub.packageId,
      packageName: sub.package?.name ?? null,
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      totalCredit: sub.totalCredit,
      usedCredit: sub.usedCredit,
      remainingCredit: sub.remainingCredit,
      isLowCredit: active && sub.remainingCredit <= lowCreditThreshold,
    };
  }

  async getSubscriptionSummary(madrasaId: number, channel: BillingChannel): Promise<SubscriptionSummaryDto> {
    const [sub, pricing] = await Promise.all([
      this.repository.findSubscription(madrasaId, channel),
      this.repository.findGlobalPricing(channel),
    ]);
    return this.toSummaryDto(channel, sub, pricing?.lowCreditThreshold ?? 100);
  }

  async getAllSubscriptionSummaries(madrasaId: number): Promise<SubscriptionSummaryDto[]> {
    return Promise.all(BILLING_CHANNELS.map((channel) => this.getSubscriptionSummary(madrasaId, channel)));
  }

  async previewSms(madrasaId: number, message: string) {
    if (!message || !message.trim()) throw new BadRequestError("message আবশ্যক");
    const analysis = analyzeSmsContent(message);
    const { sellingPrice } = await this.resolvePricing(madrasaId, "SMS");
    const sub = await this.repository.findSubscription(madrasaId, "SMS");
    return {
      ...analysis,
      pricePerSegment: sellingPrice,
      estimatedCost: sellingPrice.mul(analysis.segmentCount),
      remainingCredit: sub?.remainingCredit ?? 0,
    };
  }

  findTransactions(madrasaId: number, channel: BillingChannel | undefined, limit = 50) {
    return this.repository.findTransactions(madrasaId, channel, Math.min(limit, 200));
  }

  findUsageLogs(madrasaId: number, channel: BillingChannel | undefined, limit = 50) {
    return this.repository.findUsageLogs(madrasaId, channel, Math.min(limit, 200));
  }

  /* ================= PRICING ================= */

  async resolvePricing(madrasaId: number, channel: BillingChannel) {
    const [override, global] = await Promise.all([
      this.repository.findPricingOverride(madrasaId, channel),
      this.repository.findGlobalPricing(channel),
    ]);
    return {
      sellingPrice: override?.sellingPrice ?? global?.sellingPrice ?? new Prisma.Decimal(DEFAULT_SELLING_PRICE),
      providerCost: global?.providerCost ?? new Prisma.Decimal(DEFAULT_PROVIDER_COST),
      lowCreditThreshold: global?.lowCreditThreshold ?? 100,
    };
  }

  /* ================= SEND-TIME CREDIT CHECK + DEDUCT (PHASE 19/20) ================= */

  /**
   * Pre-flight check used to fail fast with a specific, user-friendly
   * message (PHASE 7/8) before any provider call is attempted. This is
   * advisory only - `chargeForSend` re-checks atomically regardless, so a
   * race lost between this check and the actual deduct still fails safely.
   */
  private async assertCanSend(madrasaId: number, channel: BillingChannel, unitsNeeded: number) {
    const sub = await this.repository.findSubscription(madrasaId, channel);
    const messages = creditMessages(channel);
    if (!sub) throw new BadRequestError(messages.noSubscription);
    if (sub.expiryDate.getTime() < Date.now()) throw new BadRequestError(messages.expired);
    if (sub.remainingCredit <= 0) throw new BadRequestError(messages.exhausted);
    if (sub.remainingCredit < unitsNeeded) throw new BadRequestError(messages.insufficient);
  }

  /**
   * Computes cost, atomically reserves/deducts credit, and writes both the
   * usage log row and its ledger entry in one DB transaction. Throws (with
   * no credit deducted) if the subscription is missing/expired/short on
   * credit - callers must catch this per-recipient and skip that recipient
   * rather than aborting the whole batch (see notification.service.ts).
   */
  async chargeForSend(
    madrasaId: number,
    channel: BillingChannel,
    recipient: string,
    message: string,
  ): Promise<ChargeResult> {
    const analysis = channel === "SMS" ? analyzeSmsContent(message) : null;
    const units = channel === "SMS" ? Math.max(analysis!.segmentCount, 1) : 1;

    await this.assertCanSend(madrasaId, channel, units);

    const { sellingPrice } = await this.resolvePricing(madrasaId, channel);
    const totalCost = sellingPrice.mul(units);

    return prisma.$transaction(async (tx) => {
      const deductResult = await tx.messageSubscription.updateMany({
        where: {
          madrasaId,
          channel,
          status: "ACTIVE",
          expiryDate: { gte: new Date() },
          remainingCredit: { gte: units },
        },
        data: { usedCredit: { increment: units }, remainingCredit: { decrement: units } },
      });
      if (deductResult.count === 0) {
        throw new BadRequestError(creditMessages(channel).insufficient);
      }

      const sub = await tx.messageSubscription.findUniqueOrThrow({
        where: { madrasaId_channel: { madrasaId, channel } },
      });

      const usageLog = await tx.messageUsageLog.create({
        data: {
          madrasaId,
          channel,
          recipient,
          encoding: analysis?.encoding ?? null,
          characterCount: analysis?.characterCount ?? null,
          segmentCount: units,
          pricePerUnit: sellingPrice,
          totalCost,
          creditUsed: units,
          status: "PENDING",
        },
      });

      await tx.billingTransaction.create({
        data: {
          madrasaId,
          channel,
          type: "USAGE",
          amount: null,
          creditDelta: -units,
          balanceAfter: sub.remainingCredit,
          performedByType: "SYSTEM",
          usageLogId: usageLog.id,
        },
      });

      return {
        usageLogId: usageLog.id,
        encoding: analysis?.encoding ?? null,
        characterCount: analysis?.characterCount ?? null,
        segmentCount: units,
        pricePerUnit: sellingPrice,
        totalCost,
        remainingCreditAfter: sub.remainingCredit,
      };
    });
  }

  /** Marks the reserved usage as actually sent - the provider accepted it,
   * so the deducted credit stands. */
  async finalizeSendSuccess(usageLogId: number, provider: string, providerMessageId?: string) {
    await this.repository.updateUsageLogStatus(usageLogId, "SENT", { providerMessageId });
    await prisma.messageUsageLog.update({ where: { id: usageLogId }, data: { provider } });
  }

  /**
   * Provider rejected the message before acceptance - releases the
   * reserved credit back to the wallet and records the reversal
   * (PHASE 19 step 16 / PHASE 21: never silently deduct on failure).
   */
  async releaseSendFailure(
    madrasaId: number,
    channel: BillingChannel,
    units: number,
    usageLogId: number,
    reason: string,
  ) {
    await prisma.$transaction(async (tx) => {
      const sub = await this.repository.refundCredit(madrasaId, channel, units, tx);
      await tx.messageUsageLog.update({
        where: { id: usageLogId },
        data: { status: "FAILED", failureReason: reason.slice(0, 500) },
      });
      await tx.billingTransaction.create({
        data: {
          madrasaId,
          channel,
          type: "REFUND",
          amount: null,
          creditDelta: units,
          balanceAfter: sub.remainingCredit,
          note: "Provider send failed before acceptance",
          performedByType: "SYSTEM",
          usageLogId,
        },
      });
    });
  }

  /* ================= PURCHASE REQUESTS (manual-approval flow) ================= */

  async createPurchaseRequest(
    madrasaId: number,
    requestedById: number | undefined,
    dto: { channel?: string; packageId?: number | string; paymentMethodLabel?: string; transactionRef?: string; note?: string },
  ) {
    const channel = String(dto.channel || "").toUpperCase();
    if (channel !== "SMS" && channel !== "EMAIL") throw new BadRequestError("channel must be SMS or EMAIL");

    const pkg = await this.repository.findPackageById(num(dto.packageId));
    if (!pkg || !pkg.isActive || pkg.channel !== channel) {
      throw new NotFoundError("প্যাকেজ পাওয়া যায়নি বা নিষ্ক্রিয়");
    }
    if (pkg.type === "RECHARGE") {
      const sub = await this.repository.findSubscription(madrasaId, channel as BillingChannel);
      if (!sub) {
        throw new BadRequestError(
          `রিচার্জ করার আগে অন্তত একটি ${channel === "SMS" ? "SMS" : "ইমেইল"} প্যাকেজ ক্রয় করতে হবে`,
        );
      }
    }

    return this.repository.createPurchaseRequest({
      madrasaId,
      channel: channel as BillingChannel,
      packageId: pkg.id,
      amount: pkg.price,
      paymentMethodLabel: dto.paymentMethodLabel?.trim() || null,
      transactionRef: dto.transactionRef?.trim() || null,
      note: dto.note?.trim() || null,
      requestedById: requestedById ?? null,
    });
  }

  listMyPurchaseRequests(madrasaId: number, limit = 50) {
    return this.repository.findPurchaseRequestsForMadrasa(madrasaId, Math.min(limit, 200));
  }

  listAllPurchaseRequests(status: "PENDING" | "APPROVED" | "REJECTED" | undefined, limit = 100) {
    return this.repository.findAllPurchaseRequests(status, Math.min(limit, 200));
  }

  async approvePurchaseRequest(id: number, reviewedById: number | undefined, reviewNote?: string) {
    const request = await this.repository.findPurchaseRequestById(id);
    if (!request) throw new NotFoundError("Purchase request পাওয়া যায়নি");
    if (request.status !== "PENDING") throw new ConflictError("এই request ইতিমধ্যে review হয়ে গেছে");

    const flip = await this.repository.markPurchaseRequestReviewed(id, "APPROVED", reviewedById, reviewNote);
    if (flip.count === 0) throw new ConflictError("এই request ইতিমধ্যে review হয়ে গেছে");

    await this.applyPackageToSubscription(
      request.madrasaId,
      request.channel as BillingChannel,
      request.package,
      Number(request.amount),
      reviewedById,
      "SUPER_ADMIN",
    );
  }

  async rejectPurchaseRequest(id: number, reviewedById: number | undefined, reviewNote?: string) {
    const flip = await this.repository.markPurchaseRequestReviewed(id, "REJECTED", reviewedById, reviewNote);
    if (flip.count === 0) throw new ConflictError("এই request পাওয়া যায়নি বা ইতিমধ্যে review হয়ে গেছে");
  }

  /**
   * Applies an approved package purchase to the tenant's wallet:
   *  - PACKAGE type, no existing/expired subscription -> fresh window starting today.
   *  - PACKAGE type, currently active subscription -> extends the CURRENT
   *    expiry date (chosen renewal behavior: unused validity/credit is
   *    never lost) and adds the new credit on top of what remains.
   *  - RECHARGE type -> adds credit only, validity window untouched.
   * Every branch writes exactly one BillingTransaction row in the same DB
   * transaction as the wallet update (PHASE 16: never a mutable-balance-only change).
   */
  private async applyPackageToSubscription(
    madrasaId: number,
    channel: BillingChannel,
    pkg: { id: number; type: string; credit: number; validityDays: number },
    price: number,
    performedById: number | undefined,
    performedByType: PerformedByType,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.messageSubscription.findUnique({
        where: { madrasaId_channel: { madrasaId, channel } },
      });
      const now = new Date();
      const isCurrentlyActive = !!existing && existing.status === "ACTIVE" && existing.expiryDate.getTime() >= now.getTime();

      let txType: "PACKAGE_PURCHASE" | "RECHARGE" | "RENEWAL";
      let updated;

      if (pkg.type === "RECHARGE") {
        if (!existing) throw new BadRequestError("রিচার্জ করার আগে একটি প্যাকেজ ক্রয় করতে হবে");
        txType = "RECHARGE";
        updated = await tx.messageSubscription.update({
          where: { madrasaId_channel: { madrasaId, channel } },
          data: {
            packageId: pkg.id,
            totalCredit: { increment: pkg.credit },
            remainingCredit: { increment: pkg.credit },
          },
        });
      } else if (isCurrentlyActive) {
        txType = "RENEWAL";
        updated = await tx.messageSubscription.update({
          where: { madrasaId_channel: { madrasaId, channel } },
          data: {
            packageId: pkg.id,
            expiryDate: addDays(existing!.expiryDate, pkg.validityDays),
            purchasedPrice: price,
            totalCredit: { increment: pkg.credit },
            remainingCredit: { increment: pkg.credit },
          },
        });
      } else {
        txType = "PACKAGE_PURCHASE";
        const data = {
          madrasaId,
          channel,
          packageId: pkg.id,
          startDate: now,
          expiryDate: addDays(now, pkg.validityDays),
          status: "ACTIVE" as const,
          purchasedPrice: price,
          totalCredit: pkg.credit,
          usedCredit: 0,
          remainingCredit: pkg.credit,
        };
        updated = await tx.messageSubscription.upsert({
          where: { madrasaId_channel: { madrasaId, channel } },
          create: data,
          update: data,
        });
      }

      await tx.billingTransaction.create({
        data: {
          madrasaId,
          channel,
          type: txType,
          packageId: pkg.id,
          amount: price,
          creditDelta: pkg.credit,
          balanceAfter: updated.remainingCredit,
          performedById: performedById ?? null,
          performedByType,
        },
      });

      return updated;
    });
  }

  /** Super Admin's direct credit grant/deduction (PHASE 16 MANUAL_*),
   * bypassing the purchase-request flow entirely - e.g. goodwill credit or
   * correcting a mistake. Auto-creates the wallet row on a positive grant
   * to a tenant that has never purchased anything. */
  async manualAdjustCredit(
    madrasaId: number,
    channel: BillingChannel,
    delta: number,
    note: string | undefined,
    performedById: number | undefined,
  ) {
    if (!Number.isFinite(delta) || delta === 0) throw new BadRequestError("delta একটি non-zero সংখ্যা হতে হবে");

    return prisma.$transaction(async (tx) => {
      const existing = await tx.messageSubscription.findUnique({
        where: { madrasaId_channel: { madrasaId, channel } },
      });

      if (!existing) {
        if (delta < 0) throw new BadRequestError("কোনো সক্রিয় সাবস্ক্রিপশন নেই - কমানোর কিছু নেই");
        const now = new Date();
        const created = await tx.messageSubscription.create({
          data: {
            madrasaId,
            channel,
            startDate: now,
            expiryDate: addDays(now, MANUAL_GRANT_DEFAULT_VALIDITY_DAYS),
            status: "ACTIVE",
            purchasedPrice: 0,
            totalCredit: delta,
            usedCredit: 0,
            remainingCredit: delta,
          },
        });
        await tx.billingTransaction.create({
          data: {
            madrasaId,
            channel,
            type: "MANUAL_CREDIT",
            amount: null,
            creditDelta: delta,
            balanceAfter: created.remainingCredit,
            note: note?.trim() || null,
            performedById: performedById ?? null,
            performedByType: "SUPER_ADMIN",
          },
        });
        return created;
      }

      const newRemaining = existing.remainingCredit + delta;
      if (newRemaining < 0) throw new BadRequestError("বর্তমান remaining credit-এর চেয়ে বেশি কমানো যাবে না");

      const updated = await tx.messageSubscription.update({
        where: { madrasaId_channel: { madrasaId, channel } },
        data: {
          totalCredit: delta > 0 ? { increment: delta } : undefined,
          usedCredit: delta < 0 ? { increment: -delta } : undefined,
          remainingCredit: { increment: delta },
        },
      });
      await tx.billingTransaction.create({
        data: {
          madrasaId,
          channel,
          type: delta > 0 ? "MANUAL_CREDIT" : "MANUAL_DEDUCTION",
          amount: null,
          creditDelta: delta,
          balanceAfter: updated.remainingCredit,
          note: note?.trim() || null,
          performedById: performedById ?? null,
          performedByType: "SUPER_ADMIN",
        },
      });
      return updated;
    });
  }

  /* ================= SUPER ADMIN: PACKAGES ================= */

  listPackagesAdmin(channel?: BillingChannel) {
    return this.repository.findAllPackages(channel ? { channel, deletedAt: null } : { deletedAt: null });
  }

  async createPackageAdmin(dto: Record<string, unknown>, createdById?: number) {
    const channel = String(dto.channel || "").toUpperCase();
    if (channel !== "SMS" && channel !== "EMAIL") throw new BadRequestError("channel must be SMS or EMAIL");
    const name = String(dto.name || "").trim();
    const credit = num(dto.credit);
    const price = num(dto.price);
    const validityDays = num(dto.validityDays ?? dto.validity_days);
    const type = String(dto.type || "PACKAGE").toUpperCase() === "RECHARGE" ? "RECHARGE" : "PACKAGE";

    if (!name) throw new BadRequestError("প্যাকেজের নাম আবশ্যক");
    if (credit <= 0) throw new BadRequestError("Credit 0 এর বেশি হতে হবে");
    if (price < 0) throw new BadRequestError("Price ঋণাত্মক হতে পারবে না");
    if (type === "PACKAGE" && validityDays <= 0) throw new BadRequestError("Validity days 1 বা তার বেশি হতে হবে");

    return this.repository.createPackage({
      channel: channel as BillingChannel,
      type,
      name,
      description: dto.description ? String(dto.description).trim() : null,
      price,
      currency: dto.currency ? String(dto.currency).trim() : "BDT",
      credit,
      validityDays: type === "RECHARGE" ? 0 : validityDays,
      isActive: dto.isActive === undefined ? true : Boolean(dto.isActive),
      createdById: createdById ?? null,
    });
  }

  async updatePackageAdmin(id: number, dto: Record<string, unknown>, updatedById?: number) {
    const existing = await this.repository.findPackageById(id);
    if (!existing) throw new NotFoundError("প্যাকেজ পাওয়া যায়নি");

    const name = String(dto.name || existing.name).trim();
    const credit = dto.credit === undefined ? existing.credit : num(dto.credit);
    const price = dto.price === undefined ? Number(existing.price) : num(dto.price);
    const validityDays =
      dto.validityDays === undefined && dto.validity_days === undefined
        ? existing.validityDays
        : num(dto.validityDays ?? dto.validity_days);

    if (!name) throw new BadRequestError("প্যাকেজের নাম আবশ্যক");
    if (credit <= 0) throw new BadRequestError("Credit 0 এর বেশি হতে হবে");
    if (price < 0) throw new BadRequestError("Price ঋণাত্মক হতে পারবে না");

    const result = await this.repository.updatePackage(id, {
      name,
      description: dto.description === undefined ? existing.description : String(dto.description || "").trim() || null,
      price,
      credit,
      validityDays: existing.type === "RECHARGE" ? 0 : validityDays,
      isActive: dto.isActive === undefined ? existing.isActive : Boolean(dto.isActive),
      updatedById: updatedById ?? null,
    });
    if (result.count === 0) throw new NotFoundError("প্যাকেজ পাওয়া যায়নি");
  }

  async togglePackageAdmin(id: number) {
    const pkg = await this.repository.findPackageById(id);
    if (!pkg) throw new NotFoundError("প্যাকেজ পাওয়া যায়নি");
    await this.repository.updatePackage(id, { isActive: !pkg.isActive });
  }

  async deletePackageAdmin(id: number) {
    const running = await this.repository.countRunningSubscriptionsForPackage(id);
    if (running > 0) {
      throw new ConflictError("এই প্যাকেজ বর্তমানে সক্রিয় subscription-এ ব্যবহৃত হচ্ছে। ডিলিট না করে নিষ্ক্রিয় করুন।");
    }
    const result = await this.repository.softDeletePackage(id);
    if (result.count === 0) throw new NotFoundError("প্যাকেজ পাওয়া যায়নি");
  }

  /* ================= SUPER ADMIN: PRICING ================= */

  async getGlobalPricingAdmin() {
    const rows = await this.repository.findAllGlobalPricing();
    return BILLING_CHANNELS.map((channel) => {
      const row = rows.find((r) => r.channel === channel);
      return {
        channel,
        sellingPrice: row?.sellingPrice ?? new Prisma.Decimal(DEFAULT_SELLING_PRICE),
        providerCost: row?.providerCost ?? new Prisma.Decimal(DEFAULT_PROVIDER_COST),
        lowCreditThreshold: row?.lowCreditThreshold ?? 100,
      };
    });
  }

  setGlobalPricingAdmin(channel: BillingChannel, dto: { sellingPrice?: number; providerCost?: number; lowCreditThreshold?: number }) {
    if (dto.sellingPrice !== undefined && num(dto.sellingPrice) < 0) throw new BadRequestError("Selling price ঋণাত্মক হতে পারবে না");
    if (dto.providerCost !== undefined && num(dto.providerCost) < 0) throw new BadRequestError("Provider cost ঋণাত্মক হতে পারবে না");
    return this.repository.upsertGlobalPricing(channel, {
      sellingPrice: dto.sellingPrice === undefined ? undefined : num(dto.sellingPrice),
      providerCost: dto.providerCost === undefined ? undefined : num(dto.providerCost),
      lowCreditThreshold: dto.lowCreditThreshold === undefined ? undefined : num(dto.lowCreditThreshold),
    });
  }

  setPricingOverrideAdmin(madrasaId: number, channel: BillingChannel, sellingPrice: number) {
    if (num(sellingPrice) < 0) throw new BadRequestError("Selling price ঋণাত্মক হতে পারবে না");
    return this.repository.upsertPricingOverride(madrasaId, channel, num(sellingPrice));
  }

  deletePricingOverrideAdmin(madrasaId: number, channel: BillingChannel) {
    return this.repository.deletePricingOverride(madrasaId, channel);
  }

  /* ================= SUPER ADMIN: TENANT VIEW / REPORTING ================= */

  getMadrasaSubscriptions(madrasaId: number) {
    return this.repository.findSubscriptionsForMadrasa(madrasaId);
  }

  getMadrasaUsage(madrasaId: number, channel?: BillingChannel, limit = 100) {
    return this.repository.findUsageLogs(madrasaId, channel, Math.min(limit, 300));
  }

  getMadrasaTransactions(madrasaId: number, channel?: BillingChannel, limit = 100) {
    return this.repository.findTransactions(madrasaId, channel, Math.min(limit, 300));
  }

  async getReport(channel: BillingChannel) {
    const [totals, pricing, lowCreditMadrasas] = await Promise.all([
      this.repository.reportTotals(channel),
      this.repository.findGlobalPricing(channel),
      this.repository.findLowCreditMadrasas(channel, 100),
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    const now = new Date();

    const [today, month] = await Promise.all([
      this.repository.reportUsageCostBetween(channel, startOfToday, now),
      this.repository.reportUsageCostBetween(channel, startOfMonth, now),
    ]);

    const providerCost = pricing?.providerCost ?? new Prisma.Decimal(DEFAULT_PROVIDER_COST);
    const totalUsed = totals.totalUsed;
    const totalCostEstimate = providerCost.mul(totalUsed);

    return {
      channel,
      totalSold: totals.totalSold,
      totalUsed,
      totalRemaining: totals.totalRemaining,
      revenue: totals.totalRevenue,
      providerCostTotal: totalCostEstimate,
      profit: totals.totalRevenue.sub(totalCostEstimate),
      today: { count: today._count, credit: today._sum.creditUsed || 0, cost: today._sum.totalCost || new Prisma.Decimal(0) },
      month: { count: month._count, credit: month._sum.creditUsed || 0, cost: month._sum.totalCost || new Prisma.Decimal(0) },
      lowCreditMadrasas: lowCreditMadrasas.map((s) => ({
        madrasaId: s.madrasaId,
        name: s.madrasa.name,
        slug: s.madrasa.slug,
        remainingCredit: s.remainingCredit,
      })),
      expiredCount: totals.expiredCount,
      activeSubscriptions: totals.activeSubscriptions,
    };
  }

  /** Status-sync only (PHASE 6: cron never gates access, real-time check
   * always does) - keeps the denormalized `status` column accurate for
   * dashboards/reports without requiring a read on every check. */
  async syncExpiredSubscriptions() {
    return this.repository.markExpiredSubscriptions();
  }
}

export const billingService = new BillingService();
