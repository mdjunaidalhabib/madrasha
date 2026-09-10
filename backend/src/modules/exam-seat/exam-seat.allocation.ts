import { BadRequestError } from "../../shared/errors";

/**
 * Pure seat-allocation planning logic - no DB access, so it's cheaply
 * unit-testable on its own (see __tests__/allocation.test.ts). Callers
 * (exam-seat.service.ts) fetch inputs from the DB, call these functions,
 * then persist the result in a transaction.
 */

export type SeatCandidateInput = { examCandidateId: number; roll: number | null };
export type SeatRoomInput = { roomId: number; capacity: number };
export type SeatStrategy = "SEQUENTIAL" | "ROLL_BASED" | "ALTERNATING";
export type SeatPlanEntry = { examCandidateId: number; roomId: number; seatNo: string };

export function validateCapacity(candidateCount: number, rooms: SeatRoomInput[]): void {
  const totalCapacity = rooms.reduce((sum, r) => sum + Math.max(0, r.capacity), 0);
  if (totalCapacity < candidateCount) {
    const shortfall = candidateCount - totalCapacity;
    throw new BadRequestError(
      `Insufficient seating capacity: ${candidateCount} candidate(s) but only ${totalCapacity} seat(s) across the selected rooms (short by ${shortfall})`,
    );
  }
}

const byRollAscNullsLast = (a: SeatCandidateInput, b: SeatCandidateInput): number => {
  if (a.roll === null && b.roll === null) return 0;
  if (a.roll === null) return 1;
  if (b.roll === null) return -1;
  return a.roll - b.roll;
};

export function planSeatAllocation(input: {
  candidates: SeatCandidateInput[];
  rooms: SeatRoomInput[];
  strategy: SeatStrategy;
}): SeatPlanEntry[] {
  const { candidates, rooms, strategy } = input;
  validateCapacity(candidates.length, rooms);
  if (!candidates.length) return [];

  if (strategy === "ALTERNATING") {
    const ordered = [...candidates].sort(byRollAscNullsLast);
    const seatCounters = new Map<number, number>();
    const plan: SeatPlanEntry[] = [];
    let attempts = 0;
    let i = 0;
    // Round-robin across rooms, skipping any room already at capacity, so
    // "no two adjacent roll numbers share a room" holds even when room
    // capacities differ.
    for (const candidate of ordered) {
      let roomIdx = i % rooms.length;
      while (attempts < rooms.length && (seatCounters.get(rooms[roomIdx].roomId) ?? 0) >= rooms[roomIdx].capacity) {
        i += 1;
        roomIdx = i % rooms.length;
        attempts += 1;
      }
      attempts = 0;
      const room = rooms[roomIdx];
      const seatIndex = (seatCounters.get(room.roomId) ?? 0) + 1;
      seatCounters.set(room.roomId, seatIndex);
      plan.push({ examCandidateId: candidate.examCandidateId, roomId: room.roomId, seatNo: String(seatIndex) });
      i += 1;
    }
    return plan;
  }

  const ordered = strategy === "ROLL_BASED" ? [...candidates].sort(byRollAscNullsLast) : [...candidates];

  const plan: SeatPlanEntry[] = [];
  let roomIdx = 0;
  let seatInRoom = 0;
  for (const candidate of ordered) {
    while (roomIdx < rooms.length && seatInRoom >= rooms[roomIdx].capacity) {
      roomIdx += 1;
      seatInRoom = 0;
    }
    // validateCapacity already guarantees enough total seats, so this
    // should be unreachable - guarded defensively rather than assumed.
    if (roomIdx >= rooms.length) {
      throw new BadRequestError("Insufficient seating capacity while allocating seats");
    }
    seatInRoom += 1;
    plan.push({ examCandidateId: candidate.examCandidateId, roomId: rooms[roomIdx].roomId, seatNo: String(seatInRoom) });
  }
  return plan;
}
