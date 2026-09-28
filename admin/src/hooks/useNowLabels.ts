import { useEffect, useState } from "react";
import { LOCALE_MAP, useLang } from "@madrasha/shared-ui/src/i18n";

// সেকেন্ড ধরে রিফ্রেশ করা হয় যাতে মিনিট বদলানোর সাথে সাথেই সময় আপডেট হয়
export function useNowLabels() {
  const lang = useLang();
  const locale = LOCALE_MAP[lang];
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // এই ব্রাউজার/ICU-তে Intl ডিফল্টভাবে "০৭:৫০ সকাল" দেয় - সময়ের পরে
  // সকাল/দুপুর/রাত। "সকাল ১০:৩০" আকারে (period আগে) দেখাতে formatToParts
  // দিয়ে নিজেরা সাজানো হচ্ছে।
  const parts = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    // dayPeriod is only needed for the Bangla "সকাল/দুপুর/রাত" words; other
    // languages use their normal AM/PM marker.
    ...(lang === "bn" ? { dayPeriod: "short" as const } : {}),
  }).formatToParts(now);

  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  if (lang !== "bn") {
    return { date, time: parts.map((p) => p.value).join("").trim() };
  }
  const digits = parts
    .filter((p) => p.type === "hour" || p.type === "minute" || p.type === "literal")
    .map((p) => p.value)
    .join("")
    .trim();

  const time = dayPeriod ? `${dayPeriod} ${digits}` : digits;

  return { date, time };
}
