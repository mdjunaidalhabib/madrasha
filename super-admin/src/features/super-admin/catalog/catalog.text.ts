import { defineBilingualText } from "@madrasha/shared-ui/src/i18n";

/** Academic catalogue page. Column names (division/class/subject) come from
 * the selected institution type's TERMS, so they read "বিভাগ/কিতাব" for a
 * madrasa and "স্তর/বিষয়" for a school. */
export const catalogText = defineBilingualText({
  bn: {
    title: "একাডেমিক ক্যাটালগ",
    subtitle:
      "প্রতিষ্ঠানের ধরন অনুযায়ী আলাদা শেয়ার্ড global ক্যাটালগ (বিভাগ, শ্রেণি ও কিতাব/বিষয়)। টেনে (drag) ক্রম সাজানো যায়। নতুন প্রতিষ্ঠান তৈরির সময় তার ধরনের ক্যাটালগ থেকে বেছে নেওয়া যায়।",
    typeTabs: "প্রতিষ্ঠানের ধরন",
    changeType: "এই বিভাগের প্রতিষ্ঠানের ধরন",
    drag: "সরান",
    inactiveTag: "(নিষ্ক্রিয়)",
    edit: "এডিট",
    delete: "মুছুন",
    addNew: (term: string) => `নতুন ${term} যোগ করুন`,
    none: (term: string) => `কোনো ${term} নেই`,
    selectFirst: (term: string) => `প্রথমে একটি ${term} নির্বাচন করুন`,
    loadFailed: (term: string) => `${term} লোড করা যায়নি`,
    orderFailed: (term: string) => `${term} ক্রম সংরক্ষণ করা যায়নি`,
    created: (term: string) => `${term} তৈরি হয়েছে`,
    updated: (term: string) => `${term} আপডেট হয়েছে`,
    deleted: (term: string) => `${term} মুছে ফেলা হয়েছে`,
    typeChanged: "বিভাগের ধরন পরিবর্তন হয়েছে",
    classStatusUpdated: "শ্রেণির অবস্থা আপডেট হয়েছে",
    deactivate: "নিষ্ক্রিয় করুন",
    activate: "সক্রিয় করুন",
    deleteTitle: "মুছে ফেলুন?",
    deleteMessage: (label: string) =>
      `"${label}" মুছে ফেলতে চান? এটি ব্যবহারে থাকলে (কোনো প্রতিষ্ঠান/ছাত্র যুক্ত থাকলে) মুছে ফেলা যাবে না।`,
  },
  en: {
    title: "Academic Catalog",
    subtitle:
      "A separate shared global catalogue (divisions, classes and books/subjects) per institution type. Drag to reorder. New institutions pick from the catalogue of their type.",
    typeTabs: "Institution type",
    changeType: "Institution type of this division",
    drag: "Move",
    inactiveTag: "(inactive)",
    edit: "Edit",
    delete: "Delete",
    addNew: (term) => `Add new ${term.toLowerCase()}`,
    none: (term) => `No ${term.toLowerCase()} yet`,
    selectFirst: (term) => `Select a ${term.toLowerCase()} first`,
    loadFailed: (term) => `Could not load ${term.toLowerCase()}`,
    orderFailed: (term) => `Could not save ${term.toLowerCase()} order`,
    created: (term) => `${term} created`,
    updated: (term) => `${term} updated`,
    deleted: (term) => `${term} deleted`,
    typeChanged: "Division type changed",
    classStatusUpdated: "Class status updated",
    deactivate: "Deactivate",
    activate: "Activate",
    deleteTitle: "Delete?",
    deleteMessage: (label) =>
      `Delete "${label}"? It can't be deleted while in use (linked to any institution/student).`,
  },
});
