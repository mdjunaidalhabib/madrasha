import { useEffect, useState } from "react";

// সেকেন্ড ধরে রিফ্রেশ করা হয় যাতে মিনিট বদলানোর সাথে সাথেই সময় আপডেট হয়
export function useNowLabels() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString("bn-BD", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // এই ব্রাউজার/ICU-তে Intl ডিফল্টভাবে "০৭:৫০ সকাল" দেয় - সময়ের পরে
  // সকাল/দুপুর/রাত। "সকাল ১০:৩০" আকারে (period আগে) দেখাতে formatToParts
  // দিয়ে নিজেরা সাজানো হচ্ছে।
  const parts = new Intl.DateTimeFormat("bn-BD", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    dayPeriod: "short",
  }).formatToParts(now);

  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const digits = parts
    .filter((p) => p.type === "hour" || p.type === "minute" || p.type === "literal")
    .map((p) => p.value)
    .join("")
    .trim();

  const time = dayPeriod ? `${dayPeriod} ${digits}` : digits;

  return { date, time };
}
