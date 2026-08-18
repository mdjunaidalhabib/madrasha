export type ChainGrade = {
  id: string | number;
  name: string;
  minMark: number;
  maxMark: number;
};

const sortByMaxDesc = (grades: ChainGrade[]) => [...grades].sort((a, b) => b.maxMark - a.maxMark);

/** Recomputes minMark for every grade in the list so the whole chain stays
 * gap-free by construction: the lowest grade's min is always failMark + 1,
 * and every other grade's min is the next-lower grade's max + 1. */
const chainMinMarks = (sorted: ChainGrade[], failMark: number) => {
  for (let i = sorted.length - 1; i >= 0; i--) {
    sorted[i].minMark = i === sorted.length - 1 ? failMark + 1 : sorted[i + 1].maxMark + 1;
  }
  return sorted;
};

/** Given the existing grades (any order) plus a new grade's {name, maxMark}
 * and the current fail mark, returns the full list (existing + new) sorted
 * maxMark DESC with every minMark auto-chained. The new grade carries id
 * "new" so the caller can pick it out of the result. */
export function recomputeChain(
  existing: ChainGrade[],
  newGrade: { name: string; maxMark: number },
  failMark: number,
): ChainGrade[] {
  const combined = sortByMaxDesc([...existing, { id: "new", minMark: 0, ...newGrade }]);
  return chainMinMarks(combined, failMark);
}

/** Same recompute, used after removing a grade from the list. */
export function recomputeChainAfterDelete(
  existing: ChainGrade[],
  deletedId: string | number,
  failMark: number,
): ChainGrade[] {
  const remaining = sortByMaxDesc(existing.filter((g) => g.id !== deletedId));
  return chainMinMarks(remaining, failMark);
}
