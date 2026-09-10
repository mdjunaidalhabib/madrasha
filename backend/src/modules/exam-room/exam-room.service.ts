import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examRoomRepository, ExamRoomRepository } from "./exam-room.repository";
import { CreateExamRoomRequestDto, UpdateExamRoomRequestDto } from "./exam-room.dto";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const isDuplicateError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const parseCapacity = (value: unknown): number => {
  const capacity = value === undefined || value === null || value === "" ? 0 : Number(value);
  if (Number.isNaN(capacity) || capacity < 0) throw new BadRequestError("capacity must be a non-negative number");
  return capacity;
};

export class ExamRoomService {
  constructor(private readonly repository: ExamRoomRepository = examRoomRepository) {}

  async listRooms(madrasaId: number, activeOnly?: boolean) {
    try {
      return await this.repository.findRooms(madrasaId, activeOnly);
    } catch (err) {
      return friendlyFailure("listRooms error:", err, "Failed to load exam rooms");
    }
  }

  async createRoom(madrasaId: number, dto: CreateExamRoomRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.code)) {
      throw new BadRequestError("name and code are required");
    }
    const capacity = parseCapacity(dto.capacity);

    try {
      await this.repository.createRoom(madrasaId, {
        name: String(dto.name).trim(),
        code: String(dto.code).trim(),
        capacity,
        floor: dto.floor?.trim() || null,
        location: dto.location?.trim() || null,
        notes: dto.notes?.trim() || null,
      });
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError("A room with this code already exists");
      return friendlyFailure("createRoom error:", err, "Failed to create exam room");
    }
  }

  async updateRoom(id: number, madrasaId: number, dto: UpdateExamRoomRequestDto) {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.code !== undefined) data.code = String(dto.code).trim();
    if (dto.capacity !== undefined) data.capacity = parseCapacity(dto.capacity);
    if (dto.floor !== undefined) data.floor = dto.floor?.trim() || null;
    if (dto.location !== undefined) data.location = dto.location?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateRoom(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Exam room not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError("A room with this code already exists");
      return friendlyFailure("updateRoom error:", err, "Failed to update exam room");
    }
  }

  async deactivateRoom(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deactivateRoom(id, madrasaId);
      if (!result.count) throw new NotFoundError("Exam room not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deactivateRoom error:", err, "Failed to deactivate exam room");
    }
  }
}

export const examRoomService = new ExamRoomService();
