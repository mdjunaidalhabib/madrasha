import { defineText } from "@madrasha/shared-ui/src/i18n";

/** App-wide chrome of the public frontend (PWA name, 404, network errors). */
export const appText = defineText({
  bn: {
    /** Install-prompt / manifest fallback until the tenant's name is known. */
    appName: "{{institution}}",
    pwaDescription: (name: string) => `${name} — ওয়েবসাইট ও অভিভাবক পোর্টাল`,
    notFound: "আপনি যে পেজটি খুঁজছেন সেটি নেই অথবা URL ভুল।",
    pageNotFound: "পেজ পাওয়া যায়নি",
    tooManyRequests: "অনেক বেশি অনুরোধ হয়েছে।",
    retryAfter: (seconds: string) => `অনুগ্রহ করে ${seconds} সেকেন্ড পর আবার চেষ্টা করুন।`,
  },
  en: {
    appName: "{{institution}}",
    pwaDescription: (name) => `${name} — Website & Guardian Portal`,
    notFound: "The page you are looking for does not exist, or the URL is wrong.",
    pageNotFound: "Page not found",
    tooManyRequests: "Too many requests.",
    retryAfter: (seconds) => `Please try again after ${seconds} seconds.`,
  },
});
