/** Reserve the smallest available number. Include trashed rows in `used`. */
export function createAvailableNumberPool(
  used: Iterable<number>,
  start = 1,
  end = Number.MAX_SAFE_INTEGER,
) {
  const occupied = used instanceof Set ? used : new Set(used);
  let cursor = start;
  return {
    next(): number | null {
      while (cursor <= end && occupied.has(cursor)) cursor++;
      if (cursor > end) return null;
      const next = cursor++;
      occupied.add(next);
      return next;
    },
  };
}
