import { setupPlatformBrandIcons } from "@madrasha/shared-ui/src/pwa/platformBrand";

const APP_SHORT_NAME = "EMS Admin";
const APP_DESCRIPTION =
  "মাদ্রাসা, স্কুল, কলেজ ও কিন্ডারগার্টেনের সম্পূর্ণ ডিজিটাল ম্যানেজমেন্ট সিস্টেম — Powered by Hikmah IT";

export function setupBrandIcons() {
  setupPlatformBrandIcons({
    // Desktop uses name; mobile launchers may use short_name.
    name: APP_SHORT_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
  });
}
