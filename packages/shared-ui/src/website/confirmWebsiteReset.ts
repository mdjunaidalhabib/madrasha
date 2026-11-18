import type { Lang } from "../i18n/types";
import { useConfirmStore } from "../store/confirmStore";

/** Shared three-step reset flow. Only the last confirmation may write data. */
export function confirmWebsiteReset({ institutionName, lang, onConfirm }: {
  institutionName: string;
  lang: Lang;
  onConfirm: (password: string) => Promise<void> | void;
}) {
  const bn = lang === "bn";
  const steps = bn ? [
    {
      title: "১/৩ — মূল ডেমোতে ফিরুন",
      message: `${institutionName}-এর পাবলিক ওয়েবসাইট সর্বশেষ সংরক্ষিত মূল ডেমো দিয়ে প্রতিস্থাপন করতে চান?`,
      confirmText: "হ্যাঁ, পরের ধাপ",
    },
    {
      title: "২/৩ — পরিবর্তনগুলো বুঝে নিন",
      message: "ওয়েবসাইটের নিজস্ব সেটিংস, থিম, পেজ, নোটিশ, স্লাইডার, গ্যালারি, বাণী, কমিটি ও ভিডিও প্রতিস্থাপিত হবে। ভর্তি আবেদন, শিক্ষার্থী ও প্রতিষ্ঠানের অন্যান্য তথ্য অপরিবর্তিত থাকবে।",
      confirmText: "বুঝেছি, এগিয়ে যান",
    },
    {
      title: "৩/৩ — চূড়ান্ত নিশ্চিতকরণ",
      message: `${institutionName}-এর বর্তমান ওয়েবসাইট সম্পাদনা মুছে যাবে। এই কন্ট্রোল দিয়ে আগের সম্পাদনা ফেরানো যাবে না। নিশ্চিত হলে এখন রিসেট করুন।`,
      confirmText: "নিশ্চিত, ওয়েবসাইট রিসেট করুন",
    },
  ] : [
    {
      title: "1/3 — Restore main demo",
      message: `Replace ${institutionName}'s public website with the latest saved main demo?`,
      confirmText: "Yes, next step",
    },
    {
      title: "2/3 — Review the changes",
      message: "Custom website settings, theme, pages, notices, slides, gallery, messages, committee and videos will be replaced. Admission applications, students and other institution data will be preserved.",
      confirmText: "I understand, continue",
    },
    {
      title: "3/3 — Final confirmation",
      message: `${institutionName}'s current website edits will be removed. This control cannot restore those edits. Confirm to reset the website now.`,
      confirmText: "Confirm, reset website",
    },
  ];

  const showStep = (index: number) => {
    useConfirmStore.getState().show({
      ...steps[index],
      danger: true,
      passwordLabel: index === steps.length - 1 ? (bn ? "আপনার বর্তমান লগইন পাসওয়ার্ড" : "Your current login password") : undefined,
      onCancel: undefined,
      onConfirm: index === steps.length - 1 ? (password) => onConfirm(password!) : () => showStep(index + 1),
    });
  };
  showStep(0);
}
