/**
 * মেধাস্থান (tie-aware merit position).
 *
 * rankNo (মেধাক্রম) is a plain running counter - every ranked student gets a
 * different number even on equal scores. placeNo (মেধাস্থান) instead lets
 * students with the SAME score share one place, and skips the places that
 * were taken ("standard competition ranking"): scores 100, 90, 90, 80 give
 * places 1, 2, 2, 4.
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
 * ranked immediately above (null for the first), `rankNo` is this student's
 * own sequential rank. Tied with the previous one -> same place; otherwise
 * the place is simply their rank number.
 */
export function nextMeritPlace(
  previous: MeritPlaceCursor | null,
  score: MeritScore,
  rankNo: number,
): MeritPlaceCursor {
  if (previous && sameMeritScore(previous.score, score)) {
    return { score, place: previous.place };
  }
  return { score, place: rankNo };
}
