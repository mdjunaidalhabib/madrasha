export const NOTIFICATION_CHANNELS = ["SMS", "EMAIL"] as const;

/// Business events that can trigger an automatic SMS - see
/// notification.service.ts#triggerEvent and the hook call sites in
/// student.service.ts (approveAdmission/updateStudent),
/// fee.service.ts (recordPayment), payroll.service.ts (markPaid),
/// result-panel.service.ts (publishResult), and exam-fee.service.ts
/// (setFeeActive).
export const NOTIFICATION_EVENTS = [
  "ADMISSION",
  "INFO_UPDATE",
  "FEE_PAYMENT",
  "SALARY_PAYMENT",
  "RESULT_PUBLISHED",
  "EXAM_FEE_ACTIVATED",
  "ATTENDANCE_PRESENT",
  "ATTENDANCE_ABSENT",
  "ATTENDANCE_CHECKOUT",
  "ATTENDANCE_CONSECUTIVE_ABSENT",
] as const;
export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number];

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationEventKey, string> = {
  ADMISSION: "{name} কে {class} শ্রেণীতে ভর্তি করা হয়েছে। রোল: {roll}। ধন্যবাদ।",
  INFO_UPDATE: "{name}-এর তথ্য হালনাগাদ করা হয়েছে। কোনো ভুল থাকলে অফিসে যোগাযোগ করুন।",
  FEE_PAYMENT: "{name}-এর পক্ষ থেকে {amount} টাকা ফি জমা নেওয়া হয়েছে। বকেয়া: {due} টাকা। ধন্যবাদ।",
  SALARY_PAYMENT: "{name}-এর {month} মাসের বেতন {amount} টাকা পরিশোধ করা হয়েছে। ধন্যবাদ।",
  RESULT_PUBLISHED: "{name}-এর {class} শ্রেণির {exam} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। অভিভাবক পোর্টালে লগইন করে দেখুন।",
  EXAM_FEE_ACTIVATED: "{exam} এর পরীক্ষার ফি চালু হয়েছে। {name}-এর জন্য পরীক্ষার ফি {amount} টাকা। ধন্যবাদ।",
  // {status} = "উপস্থিত" (on time) or "দেরিতে উপস্থিত" (late): the on-time text is
  // exactly the old default, and saved custom templates without {status} keep working.
  ATTENDANCE_PRESENT: "{name} আজ {time} এ মাদরাসায় {status} হয়েছে ({date})। ধন্যবাদ।",
  ATTENDANCE_ABSENT: "{name} আজ ({date}) মাদরাসায় অনুপস্থিত। কারণ জানাতে অফিসে যোগাযোগ করুন।",
  ATTENDANCE_CHECKOUT: "{name} আজ {time} এ মাদরাসা থেকে বের হয়েছে ({date})।",
  // Consecutive-absence alert (attendance-leave/attendance-alerts.service.ts):
  // {days} = streak length, {from} = first absent date of the streak, {date} = today.
  ATTENDANCE_CONSECUTIVE_ABSENT: "{name} {from} থেকে টানা {days} দিন মাদরাসায় অনুপস্থিত ({date})। অনুগ্রহ করে অফিসে যোগাযোগ করুন।",
};

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventKey, string> = {
  ADMISSION: "ভর্তি অনুমোদনের পর",
  INFO_UPDATE: "শিক্ষার্থীর তথ্য আপডেটের পর",
  FEE_PAYMENT: "ফি জমা নেওয়ার পর",
  SALARY_PAYMENT: "শিক্ষক বেতন পরিশোধের পর",
  RESULT_PUBLISHED: "পরীক্ষার ফলাফল প্রকাশের পর",
  EXAM_FEE_ACTIVATED: "পরীক্ষার ফি চালু হওয়ার পর",
  ATTENDANCE_PRESENT: "ডিভাইসে উপস্থিতির পর",
  ATTENDANCE_ABSENT: "স্বয়ংক্রিয় অনুপস্থিতির পর",
  ATTENDANCE_CHECKOUT: "ডিভাইসে চেক-আউটের পর",
  ATTENDANCE_CONSECUTIVE_ABSENT: "টানা অনুপস্থিত হলে",
};

/// Events that stay OFF until a madrasa explicitly enables them (i.e. when no
/// NotificationSetting row exists). Every other event keeps the original
/// default-enabled behaviour. A per-student-per-day SMS (ATTENDANCE_PRESENT)
/// costs real credit, so it must be opt-in.
/// The same holds for the auto-absent, check-out and consecutive-absence SMS.
export const DEFAULT_DISABLED_EVENTS: readonly NotificationEventKey[] = [
  "ATTENDANCE_PRESENT",
  "ATTENDANCE_ABSENT",
  "ATTENDANCE_CHECKOUT",
  "ATTENDANCE_CONSECUTIVE_ABSENT",
];

export const isEventEnabledByDefault = (eventKey: NotificationEventKey): boolean =>
  !DEFAULT_DISABLED_EVENTS.includes(eventKey);
