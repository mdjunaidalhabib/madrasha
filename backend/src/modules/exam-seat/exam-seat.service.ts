import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examSeatRepository, ExamSeatRepository } from "./exam-seat.repository";
import { planSeatAllocation, SeatStrategy } from "./exam-seat.allocation";
import { AutoAllocateSeatsRequestDto, ManualSeatAdjustRequestDto } from "./exam-seat.dto";
import { SEAT_ALLOCATION_STRATEGIES } from "./exam-seat.constants";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const isDuplicateError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

export class ExamSeatService {
  constructor(private readonly repository: ExamSeatRepository = examSeatRepository) {}

  async listByRoutine(madrasaId: number, examRoutineId: number) {
    try {
      return await this.repository.findByRoutine(madrasaId, examRoutineId);
    } catch (err) {
      return friendlyFailure("listByRoutine error:", err, "Failed to load seat allocations");
    }
  }

  async autoAllocate(madrasaId: number, dto: AutoAllocateSeatsRequestDto) {
    if (isEmpty(dto.exam_routine_id) || !Array.isArray(dto.room_ids) || !dto.room_ids.length) {
      throw new BadRequestError("exam_routine_id and a non-empty room_ids array are required");
    }
    const strategy = dto.strategy ? String(dto.strategy).toUpperCase() : "SEQUENTIAL";
    if (!SEAT_ALLOCATION_STRATEGIES.includes(strategy as (typeof SEAT_ALLOCATION_STRATEGIES)[number])) {
      throw new BadRequestError(`strategy must be one of ${SEAT_ALLOCATION_STRATEGIES.join(", ")}`);
    }
    const preserveManualOverrides = Boolean(dto.preserve_manual_overrides);
    const examRoutineId = Number(dto.exam_routine_id);
    const roomIds = dto.room_ids.map(Number);

    const routine = await this.repository.findRoutineForAllocation(examRoutineId, madrasaId);
    if (!routine) throw new NotFoundError("Exam routine not found");

    const rooms = await this.repository.findRoomsByIds(madrasaId, roomIds);
    if (rooms.length !== roomIds.length) {
      throw new BadRequestError("One or more selected rooms were not found or are inactive");
    }

    let candidates = await this.repository.findEligibleCandidatesForRoutine(
      madrasaId,
      routine.examId,
      routine.classId,
      routine.divisionId,
    );

    let effectiveCapacity = new Map(rooms.map((r) => [r.id, r.capacity]));

    if (preserveManualOverrides) {
      const manualOverrides = await this.repository.findManualOverridesForRoutine(madrasaId, examRoutineId);
      const manuallySeatedIds = new Set(manualOverrides.map((m) => m.examCandidateId));
      candidates = candidates.filter((c) => !manuallySeatedIds.has(c.id));

      const occupiedByRoom = new Map<number, number>();
      for (const m of manualOverrides) occupiedByRoom.set(m.roomId, (occupiedByRoom.get(m.roomId) ?? 0) + 1);
      effectiveCapacity = new Map(
        rooms.map((r) => [r.id, Math.max(0, r.capacity - (occupiedByRoom.get(r.id) ?? 0))]),
      );
    }

    const plan = planSeatAllocation({
      candidates: candidates.map((c) => ({ examCandidateId: c.id, roll: c.roll })),
      rooms: rooms.map((r) => ({ roomId: r.id, capacity: effectiveCapacity.get(r.id) ?? 0 })),
      strategy: strategy as SeatStrategy,
    });

    const roomCodeById = new Map(rooms.map((r) => [r.id, r.code]));

    try {
      await this.repository.replaceAllocations(
        madrasaId,
        examRoutineId,
        plan,
        strategy,
        preserveManualOverrides,
        roomCodeById,
      );
    } catch (err) {
      return friendlyFailure("autoAllocate error:", err, "Failed to allocate seats");
    }

    return { allocated: plan.length };
  }

  async manualAdjust(id: number, madrasaId: number, dto: ManualSeatAdjustRequestDto) {
    if (isEmpty(dto.room_id) || isEmpty(dto.seat_no)) {
      throw new BadRequestError("room_id and seat_no are required");
    }
    const existing = await this.repository.findById(id, madrasaId);
    if (!existing) throw new NotFoundError("Seat allocation not found");

    const seatNo = String(dto.seat_no).trim();
    const roomId = Number(dto.room_id);

    try {
      const [room] = await this.repository.findRoomsByIds(madrasaId, [roomId]);
      if (!room) throw new BadRequestError("Selected room was not found or is inactive");

      const result = await this.repository.updateSeat(id, madrasaId, {
        roomId,
        seatNo,
        rowNo: dto.row_no !== undefined && dto.row_no !== "" ? Number(dto.row_no) : null,
        columnNo: dto.column_no !== undefined && dto.column_no !== "" ? Number(dto.column_no) : null,
        isManualOverride: true,
        strategy: "MANUAL",
      });
      if (!result.count) throw new NotFoundError("Seat allocation not found");
      await this.repository.setCandidateNo(madrasaId, existing.examCandidateId, room.code, seatNo);
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError("This seat is already taken in this room for this exam slot");
      return friendlyFailure("manualAdjust error:", err, "Failed to adjust seat");
    }
  }

  async clearByRoutine(madrasaId: number, examRoutineId: number) {
    try {
      await this.repository.clearByRoutine(madrasaId, examRoutineId);
    } catch (err) {
      return friendlyFailure("clearByRoutine error:", err, "Failed to clear seat allocations");
    }
  }
}

export const examSeatService = new ExamSeatService();
