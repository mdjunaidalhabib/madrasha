/** Create-only catalogue shared by seed, migration tooling and tests.
 * Existing Basic/Standard/Premium keep their IDs, subscription references and
 * edited values. Never delete or reprice a legacy plan during a re-seed. */
const rows = [
  ["Starter", "স্টার্টার", 50, 3000, 1000, "Start small", "ছোট প্রতিষ্ঠানের জন্য", "#047857"],
  ["Basic", "বেসিক", 100, 5000, 2000, "Build your foundation", "ভিত্তি গড়ার জন্য", "#0369A1"],
  ["Standard", "স্ট্যান্ডার্ড", 200, 8000, 3000, "Room to grow", "বেড়ে ওঠার জন্য", "#4338CA"],
  [
    "Plus",
    "প্লাস",
    300,
    10000,
    4000,
    "For growing institutions",
    "বর্ধনশীল প্রতিষ্ঠানের জন্য",
    "#7E22CE",
  ],
  ["Pro", "প্রো", 500, 14000, 5500, "Support your next step", "পরবর্তী ধাপের জন্য", "#A21CAF"],
  ["Large", "লার্জ", 700, 17000, 7000, "Manage at scale", "বড় পরিসরে ব্যবস্থাপনা", "#BE123C"],
  [
    "Premium",
    "প্রিমিয়াম",
    1000,
    22000,
    9000,
    "For large institutions",
    "বড় প্রতিষ্ঠানের জন্য",
    "#B45309",
  ],
  [
    "Enterprise",
    "এন্টারপ্রাইজ",
    1500,
    30000,
    12500,
    "Connect your institution",
    "প্রতিষ্ঠানের সমন্বিত ব্যবস্থাপনা",
    "#0E7490",
  ],
  [
    "Max",
    "ম্যাক্স",
    2000,
    38000,
    16000,
    "Our largest standard plan",
    "সর্বোচ্চ সাধারণ পরিকল্পনা",
    "#334155",
  ],
] as const;

export const PLAN_SEEDS = rows.map(
  ([name, nameBn, studentLimit, price, renewalPrice, tagline, taglineBn, accentColor], index) => ({
    name,
    nameBn,
    studentLimit,
    price,
    renewalPrice,
    tagline,
    taglineBn,
    accentColor,
    userLimit: null,
    durationDays: 365,
    extraStudentPriceFirst: studentLimit <= 200 ? 50 : studentLimit <= 700 ? 35 : 25,
    extraStudentPriceRenewal: studentLimit <= 200 ? 20 : studentLimit <= 700 ? 14 : 10,
    sortOrder: index + 1,
    showOnLanding: 1,
    isFeatured: name === "Plus" ? 1 : 0,
    isActive: 1,
  }),
);

