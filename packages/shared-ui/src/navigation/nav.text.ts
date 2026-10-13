import { defineText } from "../i18n";

/** Text for the global Back / Refresh controls and the unsaved-changes guard. */
export const navText = defineText({
  bn: {
    back: "পেছনে যান",
    refresh: "রিফ্রেশ",
    refreshing: "রিফ্রেশ হচ্ছে...",
    refreshHint: "ক্লিক: ডেটা রিফ্রেশ • Shift+ক্লিক বা চেপে ধরুন: পুরো পেজ রিলোড",
    refreshFailed: "রিফ্রেশ সম্পূর্ণ হয়নি। আবার চেষ্টা করুন।",
    offline: "ইন্টারনেট সংযোগ নেই। সংযোগ চেক করে আবার চেষ্টা করুন।",
    unsavedTitle: "সংরক্ষণ না করা তথ্য আছে",
    unsavedMessage:
      "এই পেজে সংরক্ষণ না করা পরিবর্তন আছে। এখন চলে গেলে বা রিফ্রেশ করলে তা হারিয়ে যাবে।",
    leaveAnyway: "চলে যান / রিফ্রেশ করুন",
    stayHere: "এখানেই থাকুন",
  },
  en: {
    back: "Go back",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    refreshHint: "Click: refresh data • Shift+click or long-press: reload whole page",
    refreshFailed: "Refresh did not complete. Please try again.",
    offline: "You are offline. Check your connection and try again.",
    unsavedTitle: "You have unsaved changes",
    unsavedMessage:
      "This page has changes that are not saved. They will be lost if you leave or refresh now.",
    leaveAnyway: "Leave / Refresh",
    stayHere: "Stay here",
  },
});
