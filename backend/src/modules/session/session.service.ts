import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { sessionRepository, SessionRepository } from "./session.repository";
import { CreateSessionRequestDto, UpdateSessionRequestDto } from "./session.dto";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const parseDate = (value: unknown, label: string): Date => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestError(`${label} is invalid`);
  return date;
};

export class SessionService {
  constructor(private readonly repository: SessionRepository = sessionRepository) {}

  async list(madrasaId: number, activeOnly = false) {
    try {
      return await this.repository.findSessions(madrasaId, activeOnly);
    } catch (err) {
      return friendlyFailure("listSessions error:", err, "Failed to load sessions");
    }
  }

  async create(madrasaId: number, dto: CreateSessionRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.start_date) || isEmpty(dto.end_date)) {
      throw new BadRequestError("name, start_date and end_date are required");
    }
    const startDate = parseDate(dto.start_date, "start_date");
    const endDate = parseDate(dto.end_date, "end_date");
    if (startDate >= endDate) throw new BadRequestError("start_date must be before end_date");

    try {
      return await this.repository.runTransaction(async (tx) => {
        const session = await tx.session.create({
          data: {
            madrasaId,
            name: String(dto.name).trim(),
            startDate,
            endDate,
            isCurrent: false,
            isActive: true,
          },
        });
        if (dto.is_current) {
          await this.repository.unsetCurrentOnTx(tx, madrasaId);
          return this.repository.setCurrentOnTx(tx, session.id);
        }
        return session;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("A session with this name already exists");
      }
      return friendlyFailure("createSession error:", err, "Failed to create session");
    }
  }

  async update(id: number, madrasaId: number, dto: UpdateSessionRequestDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.start_date !== undefined) data.startDate = parseDate(dto.start_date, "start_date");
    if (dto.end_date !== undefined) data.endDate = parseDate(dto.end_date, "end_date");
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);

    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new BadRequestError("start_date must be before end_date");
    }
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateSession(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Session not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("A session with this name already exists");
      }
      return friendlyFailure("updateSession error:", err, "Failed to update session");
    }
  }

  /** Transactionally makes this the one-and-only current session for the
   * madrasa. Rejected for an inactive session so office staff can't
   * accidentally start admitting/billing into an archived session. */
  async setCurrent(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError("Session not found");
    if (!session.isActive) throw new BadRequestError("Cannot set an inactive session as current");

    try {
      await this.repository.runTransaction(async (tx) => {
        await this.repository.unsetCurrentOnTx(tx, madrasaId);
        await this.repository.setCurrentOnTx(tx, id);
      });
    } catch (err) {
      return friendlyFailure("setCurrentSession error:", err, "Failed to set current session");
    }
  }

  async delete(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError("Session not found");

    const [studentCount, feeStructureCount] = await this.repository.countReferencingRows(id, madrasaId);
    if (studentCount > 0 || feeStructureCount > 0) {
      throw new BadRequestError(
        `Cannot delete: ${studentCount} student(s) and ${feeStructureCount} fee structure(s) still reference this session`,
      );
    }

    try {
      const result = await this.repository.deleteSession(id, madrasaId);
      if (!result.count) throw new NotFoundError("Session not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteSession error:", err, "Failed to delete session");
    }
  }
}

export const sessionService = new SessionService();
