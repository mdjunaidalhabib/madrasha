import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BillingChannel, PerformedByType } from "./billing.types";

export class BillingRepository {
  /* ================= PACKAGES ================= */

  findSellablePackages(channel: BillingChannel) {
    return prisma.messagePackage.findMany({
      where: { channel, isActive: true, deletedAt: null },
      orderBy: [{ type: "asc" }, { price: "asc" }],
    });
  }

  findAllPackages(where: Prisma.MessagePackageWhereInput) {
    return prisma.messagePackage.findMany({ where, orderBy: { id: "desc" } });
  }

  findPackageById(id: number) {
    return prisma.messagePackage.findFirst({ where: { id, deletedAt: null } });
  }

  createPackage(data: Prisma.MessagePackageUncheckedCreateInput) {
    return prisma.messagePackage.create({ data });
  }

  updatePackage(id: number, data: Prisma.MessagePackageUpdateInput) {
    return prisma.messagePackage.updateMany({ where: { id, deletedAt: null }, data });
  }

  softDeletePackage(id: number) {
    return prisma.messagePackage.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  countRunningSubscriptionsForPackage(packageId: number) {
    return prisma.messageSubscription.count({
      where: { packageId, status: "ACTIVE", expiryDate: { gte: new Date() } },
    });
  }

  /* ================= SUBSCRIPTION (per madrasa+channel wallet) ================= */

  findSubscription(madrasaId: number, channel: BillingChannel) {
    return prisma.messageSubscription.findUnique({
      where: { madrasaId_channel: { madrasaId, channel } },
      include: { package: { select: { id: true, name: true } } },
    });
  }

  findSubscriptionsForMadrasa(madrasaId: number) {
    return prisma.messageSubscription.findMany({
      where: { madrasaId },
      include: { package: { select: { id: true, name: true } } },
    });
  }

  /** Creates the wallet row (first-ever purchase/manual grant) or replaces
   * it wholesale - only ever called from within a service-level
   * `prisma.$transaction` alongside a BillingTransaction ledger insert, so
   * the balance and its audit row never diverge. */
  upsertSubscription(
    madrasaId: number,
    channel: BillingChannel,
    create: Prisma.MessageSubscriptionUncheckedCreateInput,
    update: Prisma.MessageSubscriptionUpdateInput,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.messageSubscription.upsert({
      where: { madrasaId_channel: { madrasaId, channel } },
      create,
      update,
    });
  }

  /**
   * Atomically checks-and-deducts `units` of credit from an ACTIVE,
   * non-expired subscription in a single conditional UPDATE - Postgres
   * takes a row lock for the duration of this statement, so two concurrent
   * sends racing for the last unit of credit can never both succeed
   * (PHASE 19 step 12 / race-condition requirement). Returns null if the
   * row doesn't exist, is expired, or doesn't have enough credit - the
   * caller distinguishes which by re-reading the row for messaging.
   */
  async tryDeductCredit(madrasaId: number, channel: BillingChannel, units: number) {
    const result = await prisma.messageSubscription.updateMany({
      where: {
        madrasaId,
        channel,
        status: "ACTIVE",
        expiryDate: { gte: new Date() },
        remainingCredit: { gte: units },
      },
      data: { usedCredit: { increment: units }, remainingCredit: { decrement: units } },
    });
    return result.count > 0;
  }

  /** Reverses tryDeductCredit - used when the provider rejects a message
   * before acceptance (PHASE 19 step 16 / PHASE 20 step 11). */
  refundCredit(madrasaId: number, channel: BillingChannel, units: number, tx: Prisma.TransactionClient = prisma) {
    return tx.messageSubscription.update({
      where: { madrasaId_channel: { madrasaId, channel } },
      data: { usedCredit: { decrement: units }, remainingCredit: { increment: units } },
    });
  }

  markExpiredSubscriptions() {
    return prisma.messageSubscription.updateMany({
      where: { status: "ACTIVE", expiryDate: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
  }

  /* ================= USAGE LOG ================= */

  createUsageLog(data: Prisma.MessageUsageLogUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.messageUsageLog.create({ data });
  }

  updateUsageLogStatus(
    id: number,
    status: "SENT" | "FAILED",
    extra: { providerMessageId?: string; failureReason?: string } = {},
  ) {
    return prisma.messageUsageLog.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  findUsageLogs(madrasaId: number, channel: BillingChannel | undefined, limit: number) {
    return prisma.messageUsageLog.findMany({
      where: { madrasaId, ...(channel ? { channel } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /* ================= LEDGER ================= */

  createTransaction(data: Prisma.BillingTransactionUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.billingTransaction.create({ data });
  }

  findTransactions(madrasaId: number, channel: BillingChannel | undefined, limit: number) {
    return prisma.billingTransaction.findMany({
      where: { madrasaId, ...(channel ? { channel } : {}) },
      include: { package: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /* ================= PRICING ================= */

  findGlobalPricing(channel: BillingChannel) {
    return prisma.platformMessagePricing.findUnique({ where: { channel } });
  }

  findAllGlobalPricing() {
    return prisma.platformMessagePricing.findMany();
  }

  upsertGlobalPricing(channel: BillingChannel, data: { sellingPrice?: number; providerCost?: number; lowCreditThreshold?: number }) {
    return prisma.platformMessagePricing.upsert({
      where: { channel },
      create: {
        channel,
        sellingPrice: data.sellingPrice ?? 0.5,
        providerCost: data.providerCost ?? 0,
        lowCreditThreshold: data.lowCreditThreshold ?? 100,
      },
      update: data,
    });
  }

  findPricingOverride(madrasaId: number, channel: BillingChannel) {
    return prisma.madrasaMessagePricing.findUnique({
      where: { madrasaId_channel: { madrasaId, channel } },
    });
  }

  upsertPricingOverride(madrasaId: number, channel: BillingChannel, sellingPrice: number) {
    return prisma.madrasaMessagePricing.upsert({
      where: { madrasaId_channel: { madrasaId, channel } },
      create: { madrasaId, channel, sellingPrice },
      update: { sellingPrice },
    });
  }

  deletePricingOverride(madrasaId: number, channel: BillingChannel) {
    return prisma.madrasaMessagePricing.deleteMany({ where: { madrasaId, channel } });
  }

  /* ================= PURCHASE REQUESTS ================= */

  createPurchaseRequest(data: Prisma.MessagePurchaseRequestUncheckedCreateInput) {
    return prisma.messagePurchaseRequest.create({ data });
  }

  findPurchaseRequestById(id: number) {
    return prisma.messagePurchaseRequest.findUnique({
      where: { id },
      include: { package: true },
    });
  }

  findPurchaseRequestsForMadrasa(madrasaId: number, limit: number) {
    return prisma.messagePurchaseRequest.findMany({
      where: { madrasaId },
      include: { package: { select: { id: true, name: true, channel: true, type: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  findAllPurchaseRequests(status: "PENDING" | "APPROVED" | "REJECTED" | undefined, limit: number) {
    return prisma.messagePurchaseRequest.findMany({
      where: status ? { status } : {},
      include: {
        package: { select: { id: true, name: true, channel: true, type: true } },
        madrasa: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /** Conditional status flip so two admins clicking approve/reject at the
   * same instant can't both succeed against the same request. */
  markPurchaseRequestReviewed(
    id: number,
    status: "APPROVED" | "REJECTED",
    reviewedById: number | undefined,
    reviewNote: string | undefined,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.messagePurchaseRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status, reviewedById, reviewNote, reviewedAt: new Date() },
    });
  }

  /* ================= REPORTING ================= */

  async reportTotals(channel: BillingChannel) {
    const [soldAgg, usageAgg, activeAgg, lowCreditCount, expiredCount] = await Promise.all([
      prisma.billingTransaction.aggregate({
        where: { channel, type: { in: ["PACKAGE_PURCHASE", "RECHARGE", "RENEWAL"] } },
        _sum: { amount: true, creditDelta: true },
      }),
      prisma.billingTransaction.aggregate({
        where: { channel, type: "USAGE" },
        _sum: { creditDelta: true },
      }),
      prisma.messageSubscription.aggregate({
        where: { channel, status: "ACTIVE" },
        _sum: { remainingCredit: true },
        _count: true,
      }),
      prisma.messageSubscription.count({
        where: { channel, status: "ACTIVE" },
      }),
      prisma.messageSubscription.count({
        where: { channel, status: "EXPIRED" },
      }),
    ]);

    return {
      totalSold: soldAgg._sum.creditDelta || 0,
      totalRevenue: soldAgg._sum.amount || new Prisma.Decimal(0),
      totalUsed: Math.abs(usageAgg._sum.creditDelta || 0),
      totalRemaining: activeAgg._sum.remainingCredit || 0,
      activeSubscriptions: activeAgg._count,
      lowCreditCount,
      expiredCount,
    };
  }

  reportUsageCostBetween(channel: BillingChannel, from: Date, to: Date) {
    return prisma.messageUsageLog.aggregate({
      where: { channel, createdAt: { gte: from, lt: to }, status: { in: ["SENT", "DELIVERED"] } },
      _sum: { totalCost: true, creditUsed: true },
      _count: true,
    });
  }

  findLowCreditMadrasas(channel: BillingChannel, threshold: number) {
    return prisma.messageSubscription.findMany({
      where: { channel, status: "ACTIVE", remainingCredit: { lte: threshold } },
      include: { madrasa: { select: { id: true, name: true, slug: true } } },
      orderBy: { remainingCredit: "asc" },
    });
  }
}

export const billingRepository = new BillingRepository();
export type { PerformedByType };
