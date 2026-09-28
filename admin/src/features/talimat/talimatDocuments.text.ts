import { defineText } from "@madrasha/shared-ui/src/i18n";

type DocInfo = { title: string; subtitle: string; fields: string[] };

/** TalimatDocumentsPage UI chrome. Print previews keep their own sample text. */
export const talimatDocumentsText = defineText({
  bn: {
    docs: {
      "id-card": {
        title: "আইডি কার্ড",
        subtitle: "{{student}}র পরিচয়পত্র",
        fields: ["ছবি", "নাম", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "{{class}}", "{{division}}", "পিতা", "মোবাইল"],
      },
      "id-card-back": {
        title: "আইডি কার্ড ব্যাক",
        subtitle: "আইডি কার্ডের পিছনের পাতা - ইস্যু/মেয়াদ, {{head}}-এর স্বাক্ষর",
        fields: ["{{institution}}র নাম", "ইস্যু তারিখ", "মেয়াদ", "{{head}}-এর স্বাক্ষর", "ফেরতের ঠিকানা"],
      },
      "admit-card": {
        title: "প্রবেশপত্র",
        subtitle: "পরীক্ষার প্রবেশপত্র",
        fields: ["নাম", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "{{class}}", "{{division}}", "পরীক্ষা", "{{session}}"],
      },
      certificate: {
        title: "সনদ / সার্টিফিকেট",
        subtitle: "শিক্ষাগত সনদ",
        fields: ["নাম", "পিতা", "মাতা", "{{division}}", "{{class}}", "{{session}}", "ফলাফল"],
      },
      testimonial: {
        title: "প্রত্যয়ন পত্র",
        subtitle: "{{student}}র প্রত্যয়নপত্র",
        fields: ["নাম", "পিতা", "{{class}}", "{{division}}"],
      },
      transfer: {
        title: "ছাড় পত্র",
        subtitle: "{{institution}} ত্যাগ/ছাড়পত্র",
        fields: ["নাম", "পিতা", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "{{class}}", "{{division}}", "{{session}}"],
      },
      "book-label": {
        title: "পুরস্কার বই-লেবেল",
        subtitle: "মেধাক্রম ১-৩ / সেরা {{student}}দের বইয়ের প্রচ্ছদ-লেবেল",
        fields: ["নাম", "মেধাক্রম", "রোল নম্বর", "{{class}}", "{{division}}", "গ্রেড", "পরীক্ষা", "{{session}}"],
      },
    } as Record<string, DocInfo>,
    designs: { classic: "ধ্রুপদী", minimal: "মিনিমাল", arch: "খিলান" } as Record<string, string>,
    textSaved: "সেভ হয়েছে। এখন থেকে প্রকৃত শিক্ষার্থীর ডকুমেন্ট প্রিন্ট করার সময় এই লেখা দেখাবে।",
    saveFailed: "সেভ করা যায়নি। আবার চেষ্টা করুন।",
    onlyPngJpg: "শুধু PNG বা JPG ছবি আপলোড করা যাবে",
    maxSize: "ছবির সাইজ ২MB এর কম হতে হবে",
    idDesignSaved: "ডিজাইন সেভ হয়েছে। এখন থেকে আইডি কার্ড প্রিন্টে এই ডিজাইন দেখাবে।",
    admitDesignSaved: "ডিজাইন সেভ হয়েছে। এখন থেকে প্রবেশপত্র প্রিন্টে এই ডিজাইন দেখাবে।",
    letterDesignSaved: "ডিজাইন সেভ হয়েছে। এখন থেকে সনদ, প্রত্যয়ন পত্র ও ছাড়পত্র — তিনটাতেই এই ডিজাইন দেখাবে।",
    pageTitle: "ডকুমেন্ট টেমপ্লেট",
    pageSubtitle: "আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র, ছাড়পত্র ও পুরস্কার বই-লেবেলের লেখা ও ডিজাইন এখান থেকে সাজান",
    autoFieldsNote:
      "নাম, পিতা, রেজিস্ট্রেশন নম্বর, রোল, {{class}}, {{division}}, {{session}}, পরীক্ষার নাম — এই তথ্যগুলো সবসময় {{student}}র প্রকৃত তথ্য থেকে স্বয়ংক্রিয়ভাবে বসবে, এখানে হাতে লিখে পরিবর্তন করা যাবে না। নিচে শুধু চারপাশের লেখা (বাক্য/নিয়ম-কানুন) এডিট করা যাবে, আর সেভ করলে সেটি প্রকৃত প্রিন্টেও দেখাবে।",
    noticeMovedBefore: "দেয়ালে টানানোর কাস্টম নোটিশ এখন এখানে নয় — পাশের",
    noticeBoardTab: "\"নোটিশ বোর্ড\"",
    noticeMovedAfter: "ট্যাব থেকে লিখুন। সেখানে একাধিক নোটিশ আলাদাভাবে সেভ করে রাখা যায় এবং প্রয়োজনমতো যেকোনোটি বেছে প্রিন্ট করা যায়।",
    templateEdit: "টেমপ্লেট এডিট",
    autoFieldsLabel: "এই ডকুমেন্টে যেসব তথ্য স্বয়ংক্রিয়ভাবে বসে:",
    uploadOwnBg: "নিজের ব্যাকগ্রাউন্ড ছবি আপলোড করুন",
    custom: "কাস্টম",
    change: "পরিবর্তন",
    upload: "আপলোড",
    customDesignHint:
      "কাস্টম ডিজাইনে নিজের বানানো ব্যাকগ্রাউন্ড ছবি (Canva/Photoshop-এ ডিজাইন করা) আপলোড করলে তার উপর {{student}}র ছবি, নাম, রোল ইত্যাদি স্বয়ংক্রিয়ভাবে বসে যাবে।",
    saving: "সেভ হচ্ছে...",
    saveDesign: "ডিজাইন সেভ করুন",
    chooseDesign: "ডিজাইন বেছে নিন",
    letterDesignNote: "এই ডিজাইন সনদ, প্রত্যয়ন পত্র ও ছাড়পত্র — তিনটাতেই একসাথে প্রযোজ্য হবে।",
    insertIntoText: "লেখার মধ্যে যোগ করুন (এগুলো নিজে থেকে সঠিক তথ্য দিয়ে পূরণ হবে)",
    save: "সেভ করুন",
    resetToDefault: "ডিফল্ট লেখায় ফিরিয়ে নিন",
    nothingToEdit: "এই ডকুমেন্টে এডিট করার মতো কোনো বাক্য নেই — এটি শুধু শিক্ষার্থীর তথ্য দেখায়।",
    previewSample: "প্রিভিউ (নমুনা তথ্য দিয়ে)",
  },
  en: {
    docs: {
      "id-card": {
        title: "ID Card",
        subtitle: "{{student}} identity card",
        fields: ["Photo", "Name", "Registration No.", "Roll No.", "{{class}}", "{{division}}", "Father", "Mobile"],
      },
      "id-card-back": {
        title: "ID Card Back",
        subtitle: "Back side of the ID card - issue/expiry, {{head}}'s signature",
        fields: ["{{institution}} name", "Issue date", "Expiry", "{{head}}'s signature", "Return address"],
      },
      "admit-card": {
        title: "Admit Card",
        subtitle: "Exam admit card",
        fields: ["Name", "Registration No.", "Roll No.", "{{class}}", "{{division}}", "Exam", "{{session}}"],
      },
      certificate: {
        title: "Certificate",
        subtitle: "Academic certificate",
        fields: ["Name", "Father", "Mother", "{{division}}", "{{class}}", "{{session}}", "Result"],
      },
      testimonial: {
        title: "Testimonial",
        subtitle: "{{student}} testimonial",
        fields: ["Name", "Father", "{{class}}", "{{division}}"],
      },
      transfer: {
        title: "Transfer Certificate",
        subtitle: "Leaving / transfer certificate",
        fields: ["Name", "Father", "Registration No.", "Roll No.", "{{class}}", "{{division}}", "{{session}}"],
      },
      "book-label": {
        title: "Prize Book Label",
        subtitle: "Book cover labels for merit positions 1-3 / top {{student}}s",
        fields: ["Name", "Merit position", "Roll No.", "{{class}}", "{{division}}", "Grade", "Exam", "{{session}}"],
      },
    },
    designs: { classic: "Classic", minimal: "Minimal", arch: "Arch" },
    textSaved: "Saved. This text will now appear when printing real student documents.",
    saveFailed: "Could not save. Please try again.",
    onlyPngJpg: "Only PNG or JPG images can be uploaded",
    maxSize: "Image size must be under 2MB",
    idDesignSaved: "Design saved. ID card prints will now use this design.",
    admitDesignSaved: "Design saved. Admit card prints will now use this design.",
    letterDesignSaved: "Design saved. Certificates, testimonials and transfer certificates will all use this design.",
    pageTitle: "Document Templates",
    pageSubtitle: "Arrange the text and design of ID cards, admit cards, certificates, testimonials, transfer certificates and prize book labels here",
    autoFieldsNote:
      "Name, father, registration no., roll, {{class}}, {{division}}, {{session}} and exam name are always filled automatically from the {{student}}'s real data and can't be changed here. Only the surrounding text (sentences/rules) can be edited below, and once saved it appears on real prints too.",
    noticeMovedBefore: "Custom wall notices are no longer here — write them from the",
    noticeBoardTab: "\"Notice Board\"",
    noticeMovedAfter: "tab next to this one. There you can save several notices separately and print any of them when needed.",
    templateEdit: "Edit Template",
    autoFieldsLabel: "Data filled automatically in this document:",
    uploadOwnBg: "Upload your own background image",
    custom: "Custom",
    change: "Change",
    upload: "Upload",
    customDesignHint:
      "Upload your own background image (designed in Canva/Photoshop) and the {{student}}'s photo, name, roll etc. will be placed on it automatically.",
    saving: "Saving...",
    saveDesign: "Save Design",
    chooseDesign: "Choose a design",
    letterDesignNote: "This design applies to certificates, testimonials and transfer certificates together.",
    insertIntoText: "Insert into the text (filled with the correct data automatically)",
    save: "Save",
    resetToDefault: "Reset to default text",
    nothingToEdit: "This document has no editable sentences — it only shows student data.",
    previewSample: "Preview (with sample data)",
  },
});
