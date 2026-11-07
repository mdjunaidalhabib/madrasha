import { defineText } from "../../i18n";

export const planCardText = defineText({
  bn: {
    featured: "সবচেয়ে জনপ্রিয়",
    students: "জন ছাত্র পর্যন্ত",
    firstYear: "প্রথম বছর",
    renewal: "নবায়ন",
    annually: "প্রতি বছর",
    perStudent: (amount: string) => `প্রতি ছাত্র বছরে ${amount} থেকে`,
    highlights: [
      "সকল সফটওয়্যার সুবিধা",
      "ওয়েবসাইট ও হাজিরা সংযোগ",
      "বিনামূল্যে আপডেট",
      "প্রথম ক্রয়ে ৩০ দিনে ১০০% ফেরত",
    ],
    choose: "এই প্ল্যান নিন",
    unavailable: "মূল্যের জন্য যোগাযোগ করুন",
    loading: "প্ল্যান লোড হচ্ছে",
  },
  en: {
    featured: "Most popular",
    students: "students included",
    firstYear: "First year",
    renewal: "Renewal",
    annually: "per year",
    perStudent: (amount: string) => `From ${amount} per student per year`,
    highlights: [
      "Every software feature",
      "Website & attendance connector",
      "Free updates",
      "First purchase: 30-day, 100% refund",
    ],
    choose: "Choose this plan",
    unavailable: "Contact us for pricing",
    loading: "Loading plan",
  },
});
