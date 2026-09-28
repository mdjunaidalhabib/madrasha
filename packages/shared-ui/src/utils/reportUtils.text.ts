import { defineText } from "../i18n/text";

/** Printed report vocabulary - resolved in the PRINT (institution default)
 * language via getPrintText, except the absent-mark label which also shows
 * in on-screen marks entry. */
export const reportUtilsText = defineText({
  bn: {
    absentMark: "অনু",
    statuses: {
      PASS: "পাশ",
      FAIL: "ফেল",
      PRESENT: "উপস্থিত",
      ABSENT: "অনুপস্থিত",
      DRAFT: "খসড়া",
      PUBLISHED: "প্রকাশিত",
      INCOMPLETE: "অসম্পূর্ণ",
    } as Record<string, string>,
    rank1: "১ম",
    rank2: "২য়",
    rank3: "৩য়",
  },
  en: {
    absentMark: "Abs",
    statuses: {
      PASS: "Pass",
      FAIL: "Fail",
      PRESENT: "Present",
      ABSENT: "Absent",
      DRAFT: "Draft",
      PUBLISHED: "Published",
      INCOMPLETE: "Incomplete",
    },
    rank1: "1st",
    rank2: "2nd",
    rank3: "3rd",
  },
  ar: {
    absentMark: "غ",
    statuses: {
      PASS: "ناجح",
      FAIL: "راسب",
      PRESENT: "حاضر",
      ABSENT: "غائب",
      DRAFT: "مسودة",
      PUBLISHED: "منشور",
      INCOMPLETE: "غير مكتمل",
    },
    rank1: "الأول",
    rank2: "الثاني",
    rank3: "الثالث",
  },
});
