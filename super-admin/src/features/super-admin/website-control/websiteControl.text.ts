import { defineBilingualText } from "@madrasha/shared-ui/src/i18n";

export const websiteControlText = defineBilingualText({
  bn: {
    title: "ওয়েবসাইট কন্ট্রোল",
    subtitle: "ড্রপডাউন থেকে প্রতিষ্ঠান নির্বাচন করে ওয়েবসাইট স্ট্যাটাস দেখুন ও পরিবর্তন করুন।",
    institution: "প্রতিষ্ঠান",
    selectInstitution: "প্রতিষ্ঠান নির্বাচন করুন",
    id: "আইডি",
    name: "নাম",
    currentStatus: "বর্তমান স্ট্যাটাস",
    websiteStatus: "ওয়েবসাইট স্ট্যাটাস",
    statuses: { active: "সক্রিয়", limited: "সীমিত", disabled: "বন্ধ" } as Record<string, string>,
    updateStatus: "স্ট্যাটাস আপডেট করুন",
    updated: (status: string) => `ওয়েবসাইট স্ট্যাটাস "${status}" করা হয়েছে`,
  },
  en: {
    title: "Website Control",
    subtitle: "Pick an institution from the dropdown to view and change its website status.",
    institution: "Institution",
    selectInstitution: "Select institution",
    id: "ID",
    name: "Name",
    currentStatus: "Current Status",
    websiteStatus: "Website status",
    statuses: { active: "Active", limited: "Limited", disabled: "Disabled" },
    updateStatus: "Update status",
    updated: (status) => `Website status updated to ${status}`,
  },
});
