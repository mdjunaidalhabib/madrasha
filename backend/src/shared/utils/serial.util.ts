/**
 * Per-madrasa serial (sortOrder) assignment for newly linked rows.
 *
 * Every tenant-owned ordered list (a madrasa's divisions, the classes of one
 * division, the books of one class, exams, ...) numbers its rows
 * independently of the global catalogue / DB ids: a division that already has
 * 6 classes gives the next one serial 7 (sortOrder 6), whatever its Class.id.
 *
 * `items` must be the NEW rows only (already-linked rows keep their serial)
 * and should arrive in the order they are meant to appear among themselves
 * (e.g. the Super Admin catalogue order). `existing` is this madrasa's current
 * rows, grouped by the same parent key.
 */
export function appendSerials<T>(
  items: T[],
  parentOf: (item: T) => number | null,
  existing: { parentId: number | null; sortOrder: number }[],
): { item: T; sortOrder: number }[] {
  const next = new Map<number | null, number>();
  for (const row of existing) {
    next.set(row.parentId, Math.max(next.get(row.parentId) ?? 0, row.sortOrder + 1));
  }
  return items.map((item) => {
    const parentId = parentOf(item);
    const sortOrder = next.get(parentId) ?? 0;
    next.set(parentId, sortOrder + 1);
    return { item, sortOrder };
  });
}
