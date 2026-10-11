import { defineText } from "@madrasha/shared-ui/src/i18n";

/** Progress-overlay wording for the admission review pages (pending / rejected). */
export const admissionProgressText = defineText({
  bn: {
    approveTitle: "ভর্তি অনুমোদন চলছে",
    approveBulkTitle: "একাধিক ভর্তি অনুমোদন চলছে",
    reapproveTitle: "পুনঃঅনুমোদন চলছে",
    rejectTitle: "ভর্তি বাতিল করা হচ্ছে",
    deleteTitle: "স্থায়ীভাবে মুছে ফেলা হচ্ছে",
    stepValidate: "তথ্য যাচাই করা হচ্ছে",
    stepApprove: "অনুমোদন ও রেজিস্ট্রেশন সম্পন্ন করা হচ্ছে",
    stepFees: "ফি ও চালান প্রস্তুত করা হচ্ছে",
    stepReject: "আবেদন বাতিল করা হচ্ছে",
    stepDelete: "আবেদন মুছে ফেলা হচ্ছে",
    stepFinish: "সম্পন্ন করা হচ্ছে",
  },
  en: {
    approveTitle: "Approving admission",
    approveBulkTitle: "Approving admissions",
    reapproveTitle: "Re-approving admission",
    rejectTitle: "Rejecting admission",
    deleteTitle: "Deleting permanently",
    stepValidate: "Validating details",
    stepApprove: "Approving and registering",
    stepFees: "Preparing fees and invoices",
    stepReject: "Rejecting application",
    stepDelete: "Deleting application",
    stepFinish: "Finishing up",
  },
});
