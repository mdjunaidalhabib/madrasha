import { defineText } from "../../i18n";

/** Text for the generic shared-ui building blocks (dialogs, error/empty
 * states, address/date pickers, theme toggle, tenant block screen...). */
export const uiText = defineText({
  bn: {
    // AddressCascadeFields
    division: "বিভাগ",
    district: "জেলা",
    thana: "থানা / উপজেলা",
    currentValue: (value: string) => `${value} (বর্তমান)`,
    // RouteErrorBoundary / ErrorBoundary / ErrorState
    routeErrorTitle: "পেজ লোড করা যায়নি",
    routeErrorMessage: "এই পেজে একটি সমস্যা হয়েছে। মেনু থেকে অন্য পেজে যান অথবা আবার চেষ্টা করুন।",
    pageCrashedTitle: "পেজটি ক্র্যাশ করেছে",
    pageCrashedMessage: "পেজটি রিলোড করুন অথবা পেছনে গিয়ে আবার চেষ্টা করুন।",
    errorDefaultMessage: "অনুগ্রহ করে আবার চেষ্টা করুন।",
    retry: "আবার চেষ্টা করুন",
    // ConfirmDialog
    confirmQuestion: "আপনি কি নিশ্চিত?",
    pleaseWait: "অপেক্ষা করুন...",
    // ScriptInput
    onlyBangla: "শুধু বাংলায় লিখুন",
    onlyArabic: "শুধু আরবিতে লিখুন",
    onlyEnglish: "শুধু ইংরেজিতে লিখুন",
    // TenantBlockedScreen
    tenantDeletedHeading: "{{institution}} অ্যাকাউন্ট বাতিল করা হয়েছে",
    tenantSuspendedHeading: "{{institution}} অ্যাকাউন্ট সাময়িকভাবে স্থগিত",
    tenantDeletedText:
      "এই {{institution}} অ্যাকাউন্টটি স্থায়ীভাবে মুছে ফেলা হয়েছে, তাই এটি দিয়ে আর লগইন করা যাবে না। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
    tenantSuspendedText:
      "আপনার {{institution}} অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। এটি পুনরায় সক্রিয় করা হতে পারে — বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
    loginWithOther: "অন্য {{institution}} দিয়ে লগইন করুন",
    // ThemeToggle
    enableLight: "লাইট মোড চালু করুন",
    enableDark: "ডার্ক মোড চালু করুন",
    lightMode: "লাইট মোড",
    darkMode: "ডার্ক মোড",
    // CustomDatePicker
    day: "দিন",
    month: "মাস",
    year: "বছর",
    notAvailable: "প্রযোজ্য নয়",
    // Breadcrumbs
    breadcrumb: "ব্রেডক্রাম্ব",
  },
  en: {
    division: "Division",
    district: "District",
    thana: "Thana / Upazila",
    currentValue: (value) => `${value} (current)`,
    routeErrorTitle: "Could not load page",
    routeErrorMessage: "Something went wrong on this page. Go to another page from the menu or try again.",
    pageCrashedTitle: "Page crashed",
    pageCrashedMessage: "Reload the page or go back and try again.",
    errorDefaultMessage: "Please try again.",
    retry: "Retry",
    confirmQuestion: "Are you sure?",
    pleaseWait: "Please wait...",
    onlyBangla: "Write in Bangla only",
    onlyArabic: "Write in Arabic only",
    onlyEnglish: "Write in English only",
    tenantDeletedHeading: "{{institution}} account has been cancelled",
    tenantSuspendedHeading: "{{institution}} account temporarily suspended",
    tenantDeletedText:
      "This {{institution}} account has been permanently deleted, so it can no longer be used to log in. Contact support for details.",
    tenantSuspendedText:
      "Your {{institution}} account has been temporarily suspended. It may be reactivated — contact support for details.",
    loginWithOther: "Log in with another {{institution}}",
    enableLight: "Switch to light mode",
    enableDark: "Switch to dark mode",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    day: "Day",
    month: "Month",
    year: "Year",
    notAvailable: "N/A",
    breadcrumb: "Breadcrumb",
  },
  ar: {
    division: "القسم الإداري",
    district: "المحافظة",
    thana: "المركز / الناحية",
    currentValue: (value) => `${value} (الحالي)`,
    routeErrorTitle: "تعذّر تحميل الصفحة",
    routeErrorMessage: "حدثت مشكلة في هذه الصفحة. انتقل إلى صفحة أخرى من القائمة أو حاول مرة أخرى.",
    pageCrashedTitle: "تعطّلت الصفحة",
    pageCrashedMessage: "أعد تحميل الصفحة أو ارجع وحاول مرة أخرى.",
    errorDefaultMessage: "يرجى المحاولة مرة أخرى.",
    retry: "إعادة المحاولة",
    confirmQuestion: "هل أنت متأكد؟",
    pleaseWait: "يرجى الانتظار...",
    onlyBangla: "اكتب بالبنغالية فقط",
    onlyArabic: "اكتب بالعربية فقط",
    onlyEnglish: "اكتب بالإنجليزية فقط",
    tenantDeletedHeading: "تم إلغاء حساب {{institution}}",
    tenantSuspendedHeading: "تم تعليق حساب {{institution}} مؤقتًا",
    tenantDeletedText:
      "تم حذف حساب {{institution}} هذا نهائيًا، فلا يمكن تسجيل الدخول به بعد الآن. تواصل مع الدعم لمزيد من التفاصيل.",
    tenantSuspendedText:
      "تم تعليق حساب {{institution}} الخاص بك مؤقتًا. قد يُعاد تفعيله — تواصل مع الدعم لمزيد من التفاصيل.",
    loginWithOther: "تسجيل الدخول بحساب آخر",
    enableLight: "تفعيل الوضع الفاتح",
    enableDark: "تفعيل الوضع الداكن",
    lightMode: "الوضع الفاتح",
    darkMode: "الوضع الداكن",
    day: "اليوم",
    month: "الشهر",
    year: "السنة",
    notAvailable: "غير متوفر",
    breadcrumb: "مسار التنقل",
  },
});
