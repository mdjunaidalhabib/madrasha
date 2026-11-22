import { defineText } from "@madrasha/shared-ui/src/i18n";

export const guardianLoginText = defineText({
  bn: {
    attemptsRemaining: (count: string) => `আর ${count} বার চেষ্টা করতে পারবেন।`,
    phoneRequired: "আপনার মোবাইল নম্বর লিখুন।",
    phoneInvalid: "সঠিক মোবাইল নম্বর লিখুন।",
    passwordRequired: "আপনার পাসওয়ার্ড লিখুন।",
    loginSuccess: "সফলভাবে লগইন হয়েছে।",
    lockedTitle: "লগইন সাময়িকভাবে বন্ধ",
    lockedHint: "অনেকবার ভুল চেষ্টা হয়েছে। সময় শেষ হলে আবার লগইন করতে পারবেন।",
    retryIn: (time: string) => `${time} পরে চেষ্টা করুন`,
  },
  en: {
    attemptsRemaining: (count) => `${count} attempt(s) remaining.`,
    phoneRequired: "Enter your mobile number.",
    phoneInvalid: "Enter a valid mobile number.",
    passwordRequired: "Enter your password.",
    loginSuccess: "Logged in successfully.",
    lockedTitle: "Login temporarily blocked",
    lockedHint: "Too many attempts. You can log in again when the timer ends.",
    retryIn: (time) => `Try again in ${time}`,
  },
});
