import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class SubscriptionsRepository {
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  }
  async lock(tx: TransactionClient, madrasaId: number) {
    await tx.$queryRaw`SELECT id FROM madrasas WHERE id = ${madrasaId} FOR UPDATE`;
    return tx.madrasa.findFirst({ where: { id: madrasaId, deletedAt: null } });
  }
  latest(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaSubscription.findFirst({ where: { madrasaId }, orderBy: { id: "desc" } });
  }
  plans(tx: TransactionClient) {
    return tx.plan.findMany({
      where: { isActive: 1, deletedAt: null },
      orderBy: { studentLimit: "asc" },
    });
  }
  deactivate(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaSubscription.updateMany({ where: { madrasaId }, data: { isActive: 0 } });
  }
  create(tx: TransactionClient, data: Prisma.MadrasaSubscriptionUncheckedCreateInput) {
    return tx.madrasaSubscription.create({ data });
  }
  payment(tx: TransactionClient, data: Prisma.SubscriptionPaymentUncheckedCreateInput) {
    return tx.subscriptionPayment.create({ data });
  }
  activate(tx: TransactionClient, madrasaId: number, studentLimit: number) {
    return tx.madrasa.update({
      where: { id: madrasaId },
      data: { studentLimit, userLimit: null, planStatus: "active", isActive: 1 },
    });
  }
  log(
    tx: TransactionClient,
    madrasaId: number,
    action: string,
    entityId: number,
    details?: string,
  ) {
    return tx.activityLog.create({
      data: { madrasaId, action, entity: "subscriptions", entityId, details },
    });
  }
  refundRecord(tx: TransactionClient, madrasaId: number, id: number) {
    return tx.madrasaSubscription.findFirst({
      where: { id, madrasaId },
      include: { payments: { where: { status: "paid" }, orderBy: { createdAt: "asc" } } },
    });
  }
  firstPurchase(tx: TransactionClient, madrasaId: number) {
    return tx.madrasaSubscription.findFirst({
      where: { madrasaId },
      orderBy: { id: "asc" },
      select: { id: true },
    });
  }
  cancel(tx: TransactionClient, id: number, refundAmount: number, now: Date) {
    return tx.madrasaSubscription.update({
      where: { id },
      data: { isActive: 0, cancelledAt: now, refundedAt: now, refundAmount },
    });
  }
  suspend(tx: TransactionClient, madrasaId: number) {
    return tx.madrasa.update({ where: { id: madrasaId }, data: { planStatus: "suspended" } });
  }
  expiredCandidates() {
    // Latest row per tenant: a newer renewal excludes an older expired term.
    return prisma.madrasa.findMany({
      where: { deletedAt: null, subscriptions: { some: {} } },
      select: {
        id: true,
        name: true,
        subscriptions: { orderBy: { id: "desc" }, take: 1, select: { endDate: true } },
      },
    });
  }
}
export const subscriptionsRepository = new SubscriptionsRepository();
