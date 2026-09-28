import { defineText } from "@madrasha/shared-ui/src/i18n";

/** RFID attendance kiosk screen. */
export const kioskText = defineText({
  bn: {
    setupTitle: "কিওস্ক সেটআপ",
    setupHint: "এডমিন থেকে তৈরি করা কিওস্ক ডিভাইস কী পেস্ট করুন",
    deviceKey: "ডিভাইস কী",
    save: "সংরক্ষণ করুন",
    fallbackTitle: "কিওস্ক অ্যাটেন্ডেন্স",
    scanCard: "কার্ড স্ক্যান করুন",
    holdCard: "কার্ডটি কিওস্ক রিডারের কাছে ধরুন",
    fingerprintNotConnected: "ফিঙ্গারপ্রিন্ট: ডিভাইস সংযুক্ত নেই",
    resetSetup: "সেটআপ রিসেট",
    roll: "রোল:",
    success: "উপস্থিতি সফল হয়েছে",
    already: "আজকের উপস্থিতি আগেই নেওয়া হয়েছে",
    notFound: "❌ কার্ড শনাক্ত হয়নি, অ্যাডমিনের সাথে যোগাযোগ করুন",
    error: "ত্রুটি হয়েছে, আবার চেষ্টা করুন",
  },
  en: {
    setupTitle: "Kiosk Setup",
    setupHint: "Paste the kiosk device key generated from the admin panel",
    deviceKey: "Device key",
    save: "Save",
    fallbackTitle: "Kiosk Attendance",
    scanCard: "Scan your card",
    holdCard: "Hold the card near the kiosk reader",
    fingerprintNotConnected: "Fingerprint: no device connected",
    resetSetup: "Reset setup",
    roll: "Roll:",
    success: "Attendance recorded",
    already: "Today's attendance has already been recorded",
    notFound: "❌ Card not recognized, please contact the admin",
    error: "Something went wrong, please try again",
  },
});
