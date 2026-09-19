import { ABSENT_MARK } from "@madrasha/shared-ui/src/utils/reportUtils";

/** A mark cell as it is stored right now (before the edit). */
export interface OriginalMark {
  mark: number;
  is_absent?: boolean;
  note?: string | null;
}

export interface CorrectionItem {
  student_id: number;
  book_id: number;
  field: "mark" | "is_absent" | "note";
  new_value: number | boolean | string;
}

/** Turns ONE edited cell into the correction requests it needs.
 *
 * `next` uses the grid's convention: a number, or ABSENT_MARK for absent.
 * The backend corrects one field per request, so an absent<->number flip
 * becomes two (is_absent + mark), and marking someone absent also zeroes the
 * mark - mirroring what the normal save path stores for an absent subject.
 * `nextNote` is optional; pass undefined where notes aren't editable.
 * An unchanged cell yields an empty list. */
export function correctionItemsForCell(
  studentId: number,
  bookId: number,
  original: OriginalMark,
  next: number,
  nextNote?: string,
): CorrectionItem[] {
  const items: CorrectionItem[] = [];
  const add = (field: CorrectionItem["field"], value: CorrectionItem["new_value"]) =>
    items.push({ student_id: studentId, book_id: bookId, field, new_value: value });

  const wasAbsent = Boolean(original.is_absent);
  const nowAbsent = next === ABSENT_MARK;
  const originalMark = Number(original.mark);

  if (nowAbsent) {
    if (!wasAbsent) {
      add("is_absent", true);
      if (originalMark !== 0) add("mark", 0);
    }
  } else {
    if (wasAbsent) add("is_absent", false);
    if (originalMark !== next) add("mark", next);
  }

  if (nextNote !== undefined && (original.note ?? "") !== nextNote) add("note", nextNote);

  return items;
}
