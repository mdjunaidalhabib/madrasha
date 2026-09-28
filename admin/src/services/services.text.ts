import { defineText } from "@madrasha/shared-ui/src/i18n";

/**
 * Text used outside React (axios interceptors, API mappers, stores) - read
 * with getText(servicesText) - plus key→label dictionaries for the label
 * maps exported from services/*Api.ts (their *_BN constants stay for
 * backward compatibility; on-screen UI should use these instead).
 */
export const servicesText = defineText({
  bn: {
    tooManyRequests: "অনেক বেশি অনুরোধ হয়েছে।",
    retryAfter: (base: string, seconds: string) => `${base} অনুগ্রহ করে ${seconds} সেকেন্ড পর আবার চেষ্টা করুন।`,
    somethingWentWrong: "কিছু একটা সমস্যা হয়েছে",
    notMapped: "ম্যাপ করা হয়নি",
    savedDot: "সংরক্ষণ হয়েছে।",
    saveFailedRetry: "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।",
    cloudNotConfigured:
      "ক্লাউড স্টোরেজ এখনো কনফিগার করা হয়নি, তাই ছবিটি স্থায়ীভাবে সংরক্ষণ করা যাচ্ছে না। এডমিনের সাথে যোগাযোগ করুন।",
    examAttendanceStatus: {
      PRESENT: "উপস্থিত",
      ABSENT: "অনুপস্থিত",
      LATE: "বিলম্বে উপস্থিত",
      EXCUSED: "মার্জিত অনুপস্থিতি",
      WITHHELD: "স্থগিত",
    } as Record<string, string>,
    marksheetFields: {
      roll: "রোল নম্বর",
      registration_no: "রেজিস্ট্রেশন নম্বর",
      date_of_birth: "জন্ম তারিখ",
      student_name: "{{student}}র নাম",
      father_name: "পিতার নাম",
      madrasa_grade: "ফলাফল বিভাগ",
      general_grade: "গ্রেড",
      status: "ফলাফল",
      rank_no: "মেধাস্থান",
      sig_teacher: "শ্রেণি {{teacher}}ের স্বাক্ষর",
      sig_principal: "{{head}}ের স্বাক্ষর",
    } as Record<string, string>,
    admitCardFields: {
      student_name: "পরীক্ষার্থীর নাম",
      father_name: "পিতার নাম",
      class_name: "{{class}}",
      roll: "রোল নম্বর",
      registration_no: "রেজিস্ট্রেশন নম্বর",
      academic_year: "{{session}}",
    } as Record<string, string>,
    socialLinkTypes: {
      whatsapp: "WhatsApp নম্বর",
      facebook_page: "Facebook পেজ",
      facebook_profile: "Facebook প্রোফাইল",
      facebook_group: "Facebook গ্রুপ",
      youtube: "YouTube চ্যানেল",
      instagram: "Instagram",
      telegram: "Telegram",
      tiktok: "TikTok",
      x: "X (Twitter)",
      linkedin: "LinkedIn",
      website: "ওয়েবসাইট",
      other: "অন্যান্য",
    } as Record<string, string>,
  },
  en: {
    tooManyRequests: "Too many requests.",
    retryAfter: (base, seconds) => `${base} Please try again after ${seconds} seconds.`,
    somethingWentWrong: "Something went wrong",
    notMapped: "Not mapped",
    savedDot: "Saved.",
    saveFailedRetry: "Could not save. Please try again.",
    cloudNotConfigured:
      "Cloud storage is not configured yet, so the image cannot be saved permanently. Please contact the administrator.",
    examAttendanceStatus: {
      PRESENT: "Present",
      ABSENT: "Absent",
      LATE: "Late",
      EXCUSED: "Excused absence",
      WITHHELD: "Withheld",
    },
    marksheetFields: {
      roll: "Roll No.",
      registration_no: "Registration No.",
      date_of_birth: "Date of Birth",
      student_name: "{{student}} Name",
      father_name: "Father's Name",
      madrasa_grade: "Result Division",
      general_grade: "Grade",
      status: "Result",
      rank_no: "Merit Position",
      sig_teacher: "Class {{teacher}}'s Signature",
      sig_principal: "{{head}}'s Signature",
    },
    admitCardFields: {
      student_name: "Examinee Name",
      father_name: "Father's Name",
      class_name: "{{class}}",
      roll: "Roll No.",
      registration_no: "Registration No.",
      academic_year: "{{session}}",
    },
    socialLinkTypes: {
      whatsapp: "WhatsApp number",
      facebook_page: "Facebook page",
      facebook_profile: "Facebook profile",
      facebook_group: "Facebook group",
      youtube: "YouTube channel",
      instagram: "Instagram",
      telegram: "Telegram",
      tiktok: "TikTok",
      x: "X (Twitter)",
      linkedin: "LinkedIn",
      website: "Website",
      other: "Other",
    },
  },
});
