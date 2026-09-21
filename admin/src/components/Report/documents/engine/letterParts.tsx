/**
 * নোটিশ বোর্ড, সনদ ও প্রত্যয়ন পত্রের সাধারণ (ডিফল্ট) ডিজাইনের একই ধাঁচের অংশ - উপরে ডানে তারিখ,
 * নিচে ডানে ভিতরের দিকে স্বাক্ষর, আর শিরোনাম/লেখার একই ফন্ট-সাইজ। LetterDocument-এর `bare` মোডের সাথে ব্যবহার হয়।
 */
export const LETTER_HEADING_CLASS = "mb-8 text-center text-2xl font-bold";
export const LETTER_BODY_CLASS = "whitespace-pre-line text-lg leading-9 text-slate-800";

export const LetterDateLine = () => (
  <p className="mb-4 text-right text-sm font-semibold">তারিখ: ........................</p>
);

export const LetterSignatureFooter = ({ label }: { label: string }) => (
  <div className="mt-16 flex justify-end pr-12 text-sm font-semibold">
    <span>{label}</span>
  </div>
);
