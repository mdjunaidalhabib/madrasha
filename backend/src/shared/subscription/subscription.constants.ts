import { t } from "../i18n";

export const DATA_RETENTION_WARNING_DAYS = 60;
export const CUSTOM_DOMAIN_PRICES = { firstYear: 3500, renewal: 2500 } as const;
export const SUBSCRIPTION_INCLUDES = [
  { bn: "সকল সফটওয়্যার সুবিধা", en: "All software features" },
  { bn: "পাবলিক ওয়েবসাইট", en: "Public website" },
  { bn: "অনলাইন ভর্তি ফরম", en: "Online admission form" },
  { bn: "হাজিরা ডিভাইস সংযোগ", en: "Attendance-device connector" },
];
export const SUBSCRIPTION_EXCLUDES = [
  { bn: "এসএমএস/ইমেইল ক্রেডিট (আলাদা প্যাক)", en: "SMS/email credits (separate packs)" },
  { bn: "হাজিরা ডিভাইস", en: "Attendance hardware" },
  { bn: "নিজস্ব ডোমেইন (আলাদা সেবা)", en: "Custom-domain add-on" },
];

export const retentionNotice = () =>
  t({
    bn: `মেয়াদ শেষের পর ${DATA_RETENTION_WARNING_DAYS.toLocaleString("bn-BD")} দিন পর্যন্ত আপনার ডেটা সংরক্ষিত থাকবে। এরপর ডেটা যেকোনো সময় মুছে ফেলা হতে পারে এবং সংরক্ষণের নিশ্চয়তা থাকবে না। অনুগ্রহ করে এর মধ্যে নবায়ন করুন বা ডেটা ডাউনলোড করে নিন।`,
    en: `Your data will be retained for ${DATA_RETENTION_WARNING_DAYS} days after expiry. After that, data may be deleted at any time and retention is not guaranteed. Please renew or download your data within this period.`,
  });
