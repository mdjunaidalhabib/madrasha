/**
 * ছাত্র ও শিক্ষক — দুই প্রোফাইল পেজের হেডার অ্যাকশন বাটনের অভিন্ন স্টাইল।
 * আগে প্রতি বাটনে আলাদা করে `px-4 py-2` লেখা ছিল, ফলে সারিটা মোটা দেখাত আর
 * দুই পেজে অল্প অল্প করে আলাদা হয়ে যাচ্ছিল। রঙটুকু কল-সাইট থেকে যোগ হয়।
 */
export const profileActionButtonClass =
  "h-8 rounded-md px-3 text-[13px] font-medium text-white transition-all duration-200 ease-out " +
  "hover:-translate-y-px hover:shadow-md hover:shadow-black/10 hover:brightness-105 " +
  "active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-60";

export const profileOutlineButtonClass =
  "h-8 rounded-md border border-gray-300 px-3 text-[13px] font-medium text-gray-700 transition-all duration-200 ease-out " +
  "hover:-translate-y-px hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm active:translate-y-0 active:scale-95 " +
  "disabled:pointer-events-none disabled:opacity-60 " +
  "dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800";
