import { defineBilingualText } from "@madrasha/shared-ui/src/i18n";

export const notFoundText = defineBilingualText({
  bn: {
    title: "পেজটি পাওয়া যায়নি",
    message: "আপনি যে পেজটি খুঁজছেন সেটি নেই অথবা URL ভুল।",
    backToDashboard: "ড্যাশবোর্ডে ফিরে যান",
  },
  en: {
    title: "Page not found",
    message: "The page you are looking for doesn't exist or the URL is wrong.",
    backToDashboard: "Back to dashboard",
  },
});
