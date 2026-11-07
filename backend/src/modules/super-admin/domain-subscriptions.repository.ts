import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class DomainSubscriptionsRepository {
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  }
  list(madrasaId: number) {
    return prisma.madrasaDomainSubscription.findMany({
      where: { madrasaId },
      orderBy: { id: "desc" },
    });
  }
  find(tx: TransactionClient, madrasaId: number, id: number) {
    return tx.madrasaDomainSubscription.findFirst({ where: { id, madrasaId } });
  }
  history(tx: TransactionClient, madrasaId: number, domain: string) {
    return tx.madrasaDomainSubscription.count({ where: { madrasaId, domain } });
  }
  create(tx: TransactionClient, data: Prisma.MadrasaDomainSubscriptionUncheckedCreateInput) {
    return tx.madrasaDomainSubscription.create({ data });
  }
  update(
    tx: TransactionClient,
    id: number,
    data: Prisma.MadrasaDomainSubscriptionUncheckedUpdateInput,
  ) {
    return tx.madrasaDomainSubscription.update({ where: { id }, data });
  }
  connect(tx: TransactionClient, madrasaId: number, domain: string) {
    return tx.madrasa.update({ where: { id: madrasaId }, data: { customDomain: domain } });
  }
  disconnect(tx: TransactionClient, madrasaId: number, domain: string) {
    return tx.madrasa.updateMany({
      where: { id: madrasaId, customDomain: domain },
      data: { customDomain: null },
    });
  }
}
