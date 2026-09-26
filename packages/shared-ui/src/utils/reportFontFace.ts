// রিপোর্ট/ডকুমেন্টের "Kalpurush Report" @font-face এখানে, index.css-এ নয় - ইচ্ছা করেই।
//
// index.css একটা বিশাল Tailwind স্টাইলশিট যাতে অনেক @media নিয়ম আছে
// (@media print সহ)। Chrome print মোডে ঢুকলে মিডিয়া-নির্ভর স্টাইলশিটের
// RuleSet নতুন করে বানায় আর তার সাথে ওই শিটের সব @font-face-ও নতুন করে
// (আবার "unloaded" অবস্থায়) তৈরি হয়। ফলাফল: ডকুমেন্টের প্রথম Print/PDF-এ
// Kalpurush তখনো লোড হয়নি -
//   - font-display: block  -> লেখা পুরো অদৃশ্য (শুধু টেবিলের লাইন আসে)
//   - swap / optional      -> ভুল fallback ফন্টে (Hind Siliguri Bold) ছাপা হয়
// দ্বিতীয় Print-এ ঠিক থাকে, কারণ ততক্ষণে ফন্ট লোড হয়ে গেছে।
// (Chromium print preview-তে মেপে দেখা: প্রথম print 0 অক্ষর, পরেরটা ২,৮৭৭ অক্ষর।)
//
// কোনো @media-বিহীন আলাদা <style> এলিমেন্টে থাকলে মিডিয়া বদলে ওই শিট রিবিল্ড
// হয় না, তাই ফন্টটা লোডেড অবস্থাতেই থাকে আর প্রথম Print-এই Kalpurush আসে।
// index.css-এ এই @font-face আবার ফিরিয়ে আনবেন না।
//
// font-display: block - PaginatedReportPreview স্ক্রিনে ফন্ট রেডি না হওয়া
// পর্যন্ত পেজ লুকিয়ে রাখে (fontReady), আর block fallback-এর মোটা লেখা দেখানো
// আটকায় - ওই gate ছাড়া রিপোর্ট-ফন্ট ব্যবহারকারী অন্য জায়গাগুলোর (মার্কশিট,
// রসিদ ইত্যাদি) জন্যও।
const STYLE_ID = "report-font-face";

const REPORT_FONT_FACE_CSS = `
@font-face {
  font-family: "Kalpurush Report";
  src: url("/fonts/Kalpurush.ttf") format("truetype");
  font-weight: 400 700;
  font-style: normal;
  font-display: block;
}

/* পুরো ওয়েবসাইটের UI ফন্ট (--font-ui-bn)। একই ফাইল (ব্রাউজারে একবারই নামে),
   কিন্তু আলাদা family: শুধু 400 weight ঘোষণা করা, তাই font-semibold/bold-এ
   ব্রাউজার নিজে মোটা করে দেয় - UI-র heading/বাটন বোল্ড দেখায়। রিপোর্টের
   "Kalpurush Report" (400-700, synthetic bold বন্ধ) এতে বদলায় না।
   font-display: block - swap দিলে লোডের সময় আগে সাধারণ (fallback) ফন্ট দেখিয়ে
   পরে হঠাৎ Kalpurush-এ লাফ দিত, যা প্রফেশনাল দেখায় না। index.html-এ preload
   থাকায় ফন্ট সাধারণত প্রথম render-এর আগেই নেমে যায়; খুব ধীর নেটে সর্বোচ্চ
   ~৩ সেকেন্ড লেখা লুকানো থাকে, তারপর fallback। swap-এ ফিরিয়ে নেবেন না। */
@font-face {
  font-family: "Kalpurush";
  src: url("/fonts/Kalpurush.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
`;

export const installReportFontFace = () => {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = REPORT_FONT_FACE_CSS;
  document.head.appendChild(style);
};
