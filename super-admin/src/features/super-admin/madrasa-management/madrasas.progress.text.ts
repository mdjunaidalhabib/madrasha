import { defineText } from "@madrasha/shared-ui/src/i18n";

/** Progress-overlay wording for create / trash / restore / permanent delete /
 * clean of an institution (super-admin). */
export const madrasasProgressText = defineText({
  bn: {
    createTitle: "প্রতিষ্ঠান তৈরি হচ্ছে",
    createStepValidate: "তথ্য যাচাই করা হচ্ছে",
    createStepInstitution: "প্রতিষ্ঠান ও ডেটাবেস রেকর্ড তৈরি",
    createStepPlan: "প্ল্যান ও মডিউল সক্রিয় করা হচ্ছে",
    createStepSetup: "বিভাগ, শ্রেণি ও কিতাব সাজানো হচ্ছে",
    createStepUsers: "ডিফল্ট ইউজার তৈরি করা হচ্ছে",
    createStepReload: "তালিকা হালনাগাদ হচ্ছে",

    trashTitle: "ট্র্যাশে পাঠানো হচ্ছে",
    trashStepMove: "ট্র্যাশে সরানো হচ্ছে",
    trashStepSuspend: "যাচাই ও প্রস্তুতি",
    trashStepReload: "তালিকা হালনাগাদ হচ্ছে",
    trashItem: (i: string, n: string) => `${i} / ${n} — ট্র্যাশে সরানো হচ্ছে`,

    restoreTitle: "ফিরিয়ে আনা হচ্ছে",
    restoreStepRestore: "প্রতিষ্ঠান পুনরুদ্ধার করা হচ্ছে",
    restoreStepAccess: "ডেটা সচল করা হচ্ছে",
    restoreStepReload: "তালিকা হালনাগাদ হচ্ছে",

    deleteTitle: "স্থায়ীভাবে মুছে ফেলা হচ্ছে",
    deleteStepStudents: "শিক্ষার্থী ও একাডেমিক ডেটা মোছা হচ্ছে",
    deleteStepFinance: "হিসাব ও ফি-এর তথ্য মোছা হচ্ছে",
    deleteStepUsers: "ইউজার ও অ্যাক্সেস মোছা হচ্ছে",
    deleteStepFinal: "প্রতিষ্ঠানের রেকর্ড মোছা হচ্ছে",
    deleteItem: (i: string, n: string) => `${i} / ${n} — স্থায়ীভাবে মোছা হচ্ছে`,

    cleanTitle: "প্রতিষ্ঠানের ডেটা ক্লিন করা হচ্ছে",
    cleanStepVerify: "পাসওয়ার্ড ও নাম যাচাই",
    cleanStepWipe: "ডেটা মোছা হচ্ছে",
    cleanStepFinal: "চূড়ান্ত পরিষ্কার ও যাচাই",
    cleanStepReload: "তালিকা হালনাগাদ হচ্ছে",
  },
  en: {
    createTitle: "Creating institution",
    createStepValidate: "Validating details",
    createStepInstitution: "Creating institution and database records",
    createStepPlan: "Activating plan and modules",
    createStepSetup: "Setting up divisions, classes and books",
    createStepUsers: "Creating default users",
    createStepReload: "Refreshing the list",

    trashTitle: "Moving to trash",
    trashStepMove: "Moving to trash",
    trashStepSuspend: "Checking and preparing",
    trashStepReload: "Refreshing the list",
    trashItem: (i: string, n: string) => `${i} / ${n} — moving to trash`,

    restoreTitle: "Restoring",
    restoreStepRestore: "Restoring the institution",
    restoreStepAccess: "Re-enabling data",
    restoreStepReload: "Refreshing the list",

    deleteTitle: "Deleting permanently",
    deleteStepStudents: "Deleting students and academic data",
    deleteStepFinance: "Deleting accounts and fee data",
    deleteStepUsers: "Deleting users and access",
    deleteStepFinal: "Deleting the institution record",
    deleteItem: (i: string, n: string) => `${i} / ${n} — deleting permanently`,

    cleanTitle: "Cleaning institution data",
    cleanStepVerify: "Verifying password and name",
    cleanStepWipe: "Wiping data",
    cleanStepFinal: "Final cleanup and verification",
    cleanStepReload: "Refreshing the list",
  },
});
