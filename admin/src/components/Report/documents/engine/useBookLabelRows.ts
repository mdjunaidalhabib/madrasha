import { useMemo } from "react";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { printCell, printMeritRank } from "../../printFormat";
import { usePrintText } from "@madrasha/shared-ui/src/i18n";
import { reportText } from "../../report.text";

/**
 * পুরস্কার বই-লেবেলের row-তে ডিজাইনের জন্য তৈরি-করা লেখা যোগ করে:
 *   rank_label  → "১ম" / "২য়" ...
 *   class_info  → "শ্রেণি (বিভাগ) • রোল X" (বিভাগ না থাকলে বন্ধনী বাদ)
 *   exam_label  → "পরীক্ষার নাম বছর"
 * ডিজাইনে এগুলো {{rank_label}} ইত্যাদি টোকেনে বসে (দেখুন fieldBindings.ts-এর BOOK_LABEL)।
 */
export const useBookLabelRows = (rows: Record<string, any>[]) => {
  const t = usePrintText(reportText);
  return useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        rank_label: printMeritRank(row.rank_no),
        class_info: `${printCell(row, "class_name")}${
          row.division_name ? ` (${printCell(row, "division_name")})` : ""
        } • ${t.col.roll} ${printCell(row, "roll")}`,
        exam_label: `${printCell(row, "exam_name")}${row.exam_year ? ` ${toBanglaDigits(row.exam_year)}` : ""}`,
      })),
    [rows, t],
  );
};
