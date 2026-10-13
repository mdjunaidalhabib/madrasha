import { defineText } from "../../i18n";

export const brandIconPreviewText = defineText({
  bn: {
    title: "এই লোগো থেকে যা যা তৈরি হচ্ছে",
    subtitle: "নিচের আইকনগুলো লোগো থেকে স্বয়ংক্রিয়ভাবে তৈরি হয় — ব্রাউজার ট্যাব, ফোনের হোম স্ক্রিন ও ইনস্টল করা অ্যাপে এভাবেই দেখাবে।",
    empty: "লোগো দিলে এখানে সব আইকনের প্রিভিউ দেখা যাবে।",
    loading: "প্রিভিউ তৈরি হচ্ছে...",
    failed: "প্রিভিউ তৈরি করা যায়নি",
    tabTitle: "ট্যাবের নাম",
    maskSquare: "মূল",
    maskCircle: "গোল মাস্ক",
    "favicon-32.png": { name: "Favicon", use: "ব্রাউজার ট্যাব ও বুকমার্ক" },
    "apple-touch-icon.png": { name: "Apple Touch Icon", use: "iPhone/iPad হোম স্ক্রিন (সাদা টাইলে)" },
    "icon-192.png": { name: "PWA আইকন ১৯২", use: "অ্যান্ড্রয়েড/ডেস্কটপ অ্যাপ আইকন (স্বচ্ছ)" },
    "icon-512.png": { name: "PWA আইকন ৫১২", use: "অ্যাপ ইনস্টল ও স্প্ল্যাশ স্ক্রিন (স্বচ্ছ)" },
    "maskable-512.png": { name: "Maskable আইকন", use: "অ্যান্ড্রয়েড গোল/বাঁকা আকারে কাটলেও লোগো পুরো থাকে" },
  },
  en: {
    title: "What is generated from this logo",
    subtitle: "These icons are created automatically from the logo - this is how it will look in the browser tab, on phone home screens and in the installed app.",
    empty: "Add a logo to see a preview of every icon here.",
    loading: "Generating preview...",
    failed: "Could not generate the preview",
    tabTitle: "Tab title",
    maskSquare: "Original",
    maskCircle: "Round mask",
    "favicon-32.png": { name: "Favicon", use: "Browser tab and bookmarks" },
    "apple-touch-icon.png": { name: "Apple Touch Icon", use: "iPhone/iPad home screen (on a white tile)" },
    "icon-192.png": { name: "PWA icon 192", use: "Android/desktop app icon (transparent)" },
    "icon-512.png": { name: "PWA icon 512", use: "App install and splash screen (transparent)" },
    "maskable-512.png": { name: "Maskable icon", use: "Stays fully visible when Android crops it round or squircle" },
  },
});
