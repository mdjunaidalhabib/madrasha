export const NOTIFICATION_CHANNELS = ["SMS", "EMAIL"] as const;

/// Business events that can trigger an automatic SMS - see
/// notification.service.ts#triggerEvent and the hook call sites in
/// student.service.ts (approveAdmission/updateStudent),
/// fee.service.ts (recordPayment), payroll.service.ts (markPaid), and
/// result-panel.service.ts (publishResult).
export const NOTIFICATION_EVENTS = [
  "ADMISSION",
  "INFO_UPDATE",
  "FEE_PAYMENT",
  "SALARY_PAYMENT",
  "RESULT_PUBLISHED",
] as const;
export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number];

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationEventKey, string> = {
  ADMISSION: "{name} কে {class} শ্রেণীতে ভর্তি করা হয়েছে। রোল: {roll}। ধন্যবাদ।",
  INFO_UPDATE: "{name}-এর তথ্য হালনাগাদ করা হয়েছে। কোনো ভুল থাকলে অফিসে যোগাযোগ করুন।",
  FEE_PAYMENT: "{name}-এর পক্ষ থেকে {amount} টাকা ফি জমা নেওয়া হয়েছে। বকেয়া: {due} টাকা। ধন্যবাদ।",
  SALARY_PAYMENT: "{name}-এর {month} মাসের বেতন {amount} টাকা পরিশোধ করা হয়েছে। ধন্যবাদ।",
  RESULT_PUBLISHED: "{name}-এর {class} শ্রেণির {exam} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। অভিভাবক পোর্টালে লগইন করে দেখুন।",
};

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventKey, string> = {
  ADMISSION: "ভর্তি অনুমোদনের পর",
  INFO_UPDATE: "শিক্ষার্থীর তথ্য আপডেটের পর",
  FEE_PAYMENT: "ফি জমা নেওয়ার পর",
  SALARY_PAYMENT: "শিক্ষক বেতন পরিশোধের পর",
  RESULT_PUBLISHED: "পরীক্ষার ফলাফল প্রকাশের পর",
};
