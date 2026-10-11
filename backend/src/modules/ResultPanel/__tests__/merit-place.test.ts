import { describe, expect, it } from "vitest";
import { nextMeritPlace, sameMeritScore, type MeritPlaceCursor, type MeritScore } from "../merit-place";

/** Mirrors computeSummaryRows: rank is a running counter, place uses the helper. */
const placesFor = (scores: MeritScore[]) => {
  let cursor: MeritPlaceCursor | null = null;
  let rank = 0;
  return scores.map((score) => {
    rank += 1;
    cursor = nextMeritPlace(cursor, score, rank);
    return { rank, place: cursor.place };
  });
};

const t = (total: number, gpa = 0): MeritScore => ({ gpa, total });

describe("মেধাস্থান (tie-aware place)", () => {
  it("gives distinct places when every score differs", () => {
    expect(placesFor([t(500), t(450), t(400)]).map((r) => r.place)).toEqual([1, 2, 3]);
  });

  it("shares a place on equal totals and skips the next one (1,2,2,4)", () => {
    const result = placesFor([t(500), t(450), t(450), t(400)]);
    expect(result.map((r) => r.place)).toEqual([1, 2, 2, 4]);
    // মেধাক্রম stays unique and sequential
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("handles a 3-way tie at the top (1,1,1,4)", () => {
    expect(placesFor([t(500), t(500), t(500), t(300)]).map((r) => r.place)).toEqual([1, 1, 1, 4]);
  });

  it("with GPA, same total but different GPA is NOT a tie", () => {
    expect(placesFor([t(480, 5), t(480, 4.5)]).map((r) => r.place)).toEqual([1, 2]);
  });

  it("with GPA, same GPA and same total IS a tie", () => {
    expect(placesFor([t(480, 5), t(480, 5), t(470, 5)]).map((r) => r.place)).toEqual([1, 1, 3]);
  });

  it("tolerates floating point noise in totals", () => {
    expect(sameMeritScore(t(0.1 + 0.2), t(0.3))).toBe(true);
    expect(placesFor([t(0.1 + 0.2), t(0.3)]).map((r) => r.place)).toEqual([1, 1]);
  });
});
