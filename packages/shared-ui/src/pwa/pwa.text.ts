import { defineText } from "../i18n";

export const pwaText = defineText({
  bn: {
    description: "এক ক্লিকে ইনস্টল করুন — হোম স্ক্রিন থেকে দ্রুত খুলুন, অ্যাপের মতো ব্যবহার করুন।",
    dialogLabel: "অ্যাপ ইনস্টল",
    installApp: (name: string) => `${name} অ্যাপ ইনস্টল করুন`,
    iosStep1Before: "নিচের",
    iosStep1After: "Share বাটনে চাপুন",
    iosStep2: "“Add to Home Screen” নির্বাচন করুন",
    iosStep3: "উপরে “Add” চাপুন",
    notNow: "এখন না",
    install: "ইনস্টল",
  },
  en: {
    description: "Install in one click — open it quickly from your home screen and use it like an app.",
    dialogLabel: "Install app",
    installApp: (name) => `Install the ${name} app`,
    iosStep1Before: "Tap the",
    iosStep1After: "Share button below",
    iosStep2: "Choose “Add to Home Screen”",
    iosStep3: "Tap “Add” at the top",
    notNow: "Not now",
    install: "Install",
  },
});
