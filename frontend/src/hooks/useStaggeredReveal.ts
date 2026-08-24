import { useEffect, useState } from "react";

// এর নিচে (<=) রো থাকলে স্ট্যাগারিং হয় না — একবারেই সব রেন্ডার হয়, আজকের
// আচরণ অপরিবর্তিত থাকে। এর বেশি হলে (হাজার+ শিক্ষার্থীর আইডি/অ্যাডমিট কার্ড
// প্রিন্ট) একই ফ্রেমে শত শত ছবি ডিকোড করতে গিয়ে মেইন থ্রেড ব্লক হয়ে যায়,
// তাই ব্যাচে ব্যাচে বসানো হয়।
const STAGGER_THRESHOLD = 60;
const DEFAULT_BATCH_SIZE = 50;

/**
 * বড় রো-সেট (ID কার্ড / অ্যাডমিট কার্ড গ্রিড) একবারে DOM-এ বসানোর বদলে
 * requestAnimationFrame দিয়ে ব্যাচে ব্যাচে "reveal" করে দেখায় কতগুলো রো এই
 * মুহূর্তে রেন্ডার করা উচিত। থ্রেশহোল্ডের নিচে সাথে সাথেই total রিটার্ন করে।
 *
 * PaginatedReportPreview-এর অফ-স্ক্রিন পেজিনেশন-মেজারমেন্ট পাস এই একই
 * কম্পোনেন্টগুলোকে rows prop দিয়ে মাউন্ট করে এবং শেষ পর্যন্ত সম্পূর্ণ,
 * চূড়ান্ত সেট DOM-এ চায় — সব ব্যাচ reveal হয়ে গেলে এই হুক আবার সবসময় `total`
 * ফেরত দেয়, তাই সম্পূর্ণ reveal হওয়ার পর আউটপুট আগের (স্ট্যাগারবিহীন)
 * কোডের সাথে একদম অভিন্ন থাকে — মাঝের ধাপগুলো শুধু ব্যবহারকারীর ব্রাউজারে
 * প্রথম পেইন্টের সময়টুকু হালকা করে।
 */
export const useStaggeredReveal = (
  total: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
) => {
  const [revealed, setRevealed] = useState(() =>
    total > STAGGER_THRESHOLD ? Math.min(batchSize, total) : total,
  );

  // rows বদলে গেলে (ফিল্টার পরিবর্তন, নতুন রিপোর্ট) প্রথম ব্যাচ থেকে আবার শুরু
  useEffect(() => {
    setRevealed(total > STAGGER_THRESHOLD ? Math.min(batchSize, total) : total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  useEffect(() => {
    if (revealed >= total) return;
    const frame = requestAnimationFrame(() => {
      setRevealed((prev) => Math.min(prev + batchSize, total));
    });
    return () => cancelAnimationFrame(frame);
  }, [revealed, total, batchSize]);

  return revealed;
};
