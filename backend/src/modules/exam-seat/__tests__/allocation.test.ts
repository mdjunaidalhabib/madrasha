import { describe, expect, it } from "vitest";
import { validateCapacity, planSeatAllocation } from "../exam-seat.allocation";

describe("validateCapacity", () => {
  it("passes when capacity is sufficient", () => {
    expect(() => validateCapacity(20, [{ roomId: 1, capacity: 10 }, { roomId: 2, capacity: 10 }])).not.toThrow();
  });

  it("throws naming the exact shortfall when capacity is insufficient", () => {
    expect(() => validateCapacity(25, [{ roomId: 1, capacity: 10 }, { roomId: 2, capacity: 10 }])).toThrow(
      /short by 5/,
    );
  });
});

describe("planSeatAllocation - SEQUENTIAL", () => {
  it("fills the first room to capacity before spilling into the next", () => {
    const plan = planSeatAllocation({
      candidates: [1, 2, 3, 4, 5].map((id) => ({ examCandidateId: id, roll: null })),
      rooms: [
        { roomId: 10, capacity: 3 },
        { roomId: 20, capacity: 3 },
      ],
      strategy: "SEQUENTIAL",
    });

    expect(plan.filter((p) => p.roomId === 10)).toHaveLength(3);
    expect(plan.filter((p) => p.roomId === 20)).toHaveLength(2);
    expect(plan.map((p) => p.seatNo)).toEqual(["1", "2", "3", "1", "2"]);
  });

  it("throws instead of silently dropping candidates when capacity is insufficient", () => {
    expect(() =>
      planSeatAllocation({
        candidates: [1, 2, 3].map((id) => ({ examCandidateId: id, roll: null })),
        rooms: [{ roomId: 10, capacity: 1 }],
        strategy: "SEQUENTIAL",
      }),
    ).toThrow(/Insufficient seating capacity/);
  });
});

describe("planSeatAllocation - ROLL_BASED", () => {
  it("orders candidates by roll before filling rooms, nulls last", () => {
    const plan = planSeatAllocation({
      candidates: [
        { examCandidateId: 1, roll: 30 },
        { examCandidateId: 2, roll: 10 },
        { examCandidateId: 3, roll: null },
        { examCandidateId: 4, roll: 20 },
      ],
      rooms: [{ roomId: 10, capacity: 4 }],
      strategy: "ROLL_BASED",
    });

    expect(plan.map((p) => p.examCandidateId)).toEqual([2, 4, 1, 3]);
    expect(plan.map((p) => p.seatNo)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("planSeatAllocation - ALTERNATING", () => {
  it("interleaves adjacent rolls across rooms so no two neighbours share a room", () => {
    const plan = planSeatAllocation({
      candidates: [1, 2, 3, 4, 5, 6].map((id) => ({ examCandidateId: id, roll: id })),
      rooms: [
        { roomId: 10, capacity: 3 },
        { roomId: 20, capacity: 3 },
      ],
      strategy: "ALTERNATING",
    });

    const roomByCandidate = new Map(plan.map((p) => [p.examCandidateId, p.roomId]));
    expect(roomByCandidate.get(1)).not.toBe(roomByCandidate.get(2));
    expect(roomByCandidate.get(2)).not.toBe(roomByCandidate.get(3));
    // Even split across the two equal-capacity rooms.
    expect(plan.filter((p) => p.roomId === 10)).toHaveLength(3);
    expect(plan.filter((p) => p.roomId === 20)).toHaveLength(3);
  });

  it("respects per-room capacity when rooms are uneven", () => {
    const plan = planSeatAllocation({
      candidates: [1, 2, 3, 4, 5].map((id) => ({ examCandidateId: id, roll: id })),
      rooms: [
        { roomId: 10, capacity: 1 },
        { roomId: 20, capacity: 4 },
      ],
      strategy: "ALTERNATING",
    });

    expect(plan.filter((p) => p.roomId === 10)).toHaveLength(1);
    expect(plan.filter((p) => p.roomId === 20)).toHaveLength(4);
  });
});

describe("planSeatAllocation - empty input", () => {
  it("returns an empty plan without error", () => {
    expect(planSeatAllocation({ candidates: [], rooms: [{ roomId: 1, capacity: 5 }], strategy: "SEQUENTIAL" })).toEqual(
      [],
    );
  });
});
