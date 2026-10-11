/**
 * মেধাস্থান (tie-aware merit position).
 *
 * rankNo (মেধাক্রম) is a plain running counter - every ranked student gets a
 * different number even on equal scores. placeNo (মেধাস্থান) instead lets
 * students with the SAME score share one place, and the next lower score
 * simply takes the next place number, with no gaps ("dense ranking"):
 * scores 100, 100, 90, 80 give places 1, 1, 2, 3.
 *
 * "Same score" is exactly the key the result sort uses: GPA (0 when the
 * tenant has no GPA mode) and then the total marks.
 */

export interface MeritScore {
  gpa: number;
  total: number;
}

export interface MeritPlaceCursor {
  score: MeritScore;
  place: number;
}

// Marks can carry fractions (e.g. 0.5 steps) so totals are compared with a
// tiny tolerance instead of strict ===. GPA is already rounded to 2 decimals.
const EPSILON = 1e-6;

export function sameMeritScore(a: MeritScore, b: MeritScore): boolean {
  return Math.abs(a.gpa - b.gpa) < EPSILON && Math.abs(a.total - b.total) < EPSILON;
}

/**
 * Place for the next ranked student. `previous` is the cursor of the student
 * ranked immediately above (null for the first). Tied with the previous one
 * -> same place; otherwise the place is the previous place + 1 (no gaps).
 * `rankNo` is kept in the signature for callers but no longer affects the place.
 */
export function nextMeritPlace(
  previous: MeritPlaceCursor | null,
  score: MeritScore,
  _rankNo?: number,
): MeritPlaceCursor {
  if (previous && sameMeritScore(previous.score, score)) {
    return { score, place: previous.place };
  }
  return { score, place: previous ? previous.place + 1 : 1 };
}
