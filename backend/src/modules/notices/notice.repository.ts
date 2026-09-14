import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class NoticeRepository {
  findMany(madrasaId: number) {
    return prisma.printableNotice.findMany({
      where: { madrasaId },
      orderBy: { updatedAt: "desc" },
    });
  }

  findById(id: number, madrasaId: number) {
    return prisma.printableNotice.findFirst({ where: { id, madrasaId } });
  }

  create(madrasaId: number, data: Omit<Prisma.PrintableNoticeUncheckedCreateInput, "madrasaId">) {
    return prisma.printableNotice.create({ data: { ...data, madrasaId } });
  }

  update(id: number, madrasaId: number, data: Prisma.PrintableNoticeUpdateInput) {
    return prisma.printableNotice.updateMany({ where: { id, madrasaId }, data });
  }

  delete(id: number, madrasaId: number) {
    return prisma.printableNotice.deleteMany({ where: { id, madrasaId } });
  }
}

export const noticeRepository = new NoticeRepository();
