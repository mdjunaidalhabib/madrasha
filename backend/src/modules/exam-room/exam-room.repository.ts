import { prisma } from "../../shared/database/prisma";

export class ExamRoomRepository {
  findRooms(madrasaId: number, activeOnly?: boolean) {
    return prisma.examRoom.findMany({
      where: { madrasaId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ name: "asc" }],
    });
  }

  findRoomById(id: number, madrasaId: number) {
    return prisma.examRoom.findFirst({ where: { id, madrasaId } });
  }

  createRoom(madrasaId: number, data: Record<string, unknown>) {
    return prisma.examRoom.create({ data: { ...data, madrasaId } as any });
  }

  updateRoom(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.examRoom.updateMany({ where: { id, madrasaId }, data });
  }

  deactivateRoom(id: number, madrasaId: number) {
    return prisma.examRoom.updateMany({ where: { id, madrasaId }, data: { isActive: false } });
  }
}

export const examRoomRepository = new ExamRoomRepository();
