import { useMemo } from "react";
import { cellValue, formatMeritRank, toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";

/**
 * পুরস্কার বই-লেবেলের row-তে ডিজাইনের জন্য তৈরি-করা লেখা যোগ করে:
 *   rank_label  → "১ম" / "২য়" ...
 *   class_info  → "শ্রেণি (বিভাগ) • রোল X" (বিভাগ না থাকলে বন্ধনী বাদ)
 *   exam_label  → "পরীক্ষার নাম বছর"
 * ডিজাইনে এগুলো {{rank_label}} ইত্যাদি টোকেনে বসে (দেখুন fieldBindings.ts-এর BOOK_LABEL)।
 */
export const useBookLabelRows = (rows: Record<string, any>[]) =>
  useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        rank_label: formatMeritRank(row.rank_no),
        class_info: `${cellValue(row, "class_name")}${
          row.division_name ? ` (${cellValue(row, "division_name")})` : ""
        } • রোল ${cellValue(row, "roll")}`,
        exam_label: `${cellValue(row, "exam_name")}${row.exam_year ? ` ${toBanglaDigits(row.exam_year)}` : ""}`,
      })),
    [rows],
  );
