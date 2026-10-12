/** ওভারভিউ/ড্যাশবোর্ডের জন্য নম্বর এন্ট্রির অগ্রগতি — বিষয় (subject) অনুযায়ী। */
export interface EntryProgressInput {
  total_students: number;
  entered_students: number;
  started_students?: number;
  /** ক্লাসের সক্রিয় বিষয় সংখ্যা। */
  total_subjects?: number;
  /** যে বিষয়ে ক্লাসের সব শিক্ষার্থীর নম্বর এন্ট্রি হয়েছে। */
  completed_subjects?: number;
}

/** বিষয়ভিত্তিক সংখ্যা পাওয়া গেলে সেটাই, নইলে আগের শিক্ষার্থীভিত্তিক সংখ্যা। */
export const getEntryProgress = (s: EntryProgressInput) => {
  if (typeof s.total_subjects === "number" && s.total_subjects > 0) {
    return { done: s.completed_subjects ?? 0, total: s.total_subjects, unit: "subject" as const };
  }
  return { done: s.entered_students, total: s.total_students, unit: "student" as const };
};

/** সব বিষয়ে সব শিক্ষার্থীর নম্বর এন্ট্রি হয়েছে কি না। */
export const isEntryComplete = (s: EntryProgressInput | undefined) => {
  if (!s) return false;
  const p = getEntryProgress(s);
  return p.total > 0 && p.done >= p.total;
};

/** অন্তত কিছু নম্বর এন্ট্রি শুরু হয়েছে কি না। */
export const isEntryStarted = (s: EntryProgressInput | undefined) =>
  !!s && (s.started_students ?? s.entered_students) > 0;
