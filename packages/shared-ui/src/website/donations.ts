export type DonationMethod = {
  type: "bkash" | "nagad" | "rocket" | "bank";
  accountName: string;
  accountNumber: string;
  details: string;
  accountType?: "personal" | "merchant" | "savings" | "current";
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
};

export const donationAccountTypes = {
  personal: { bn: "পার্সোনাল", en: "Personal" },
  merchant: { bn: "মার্চেন্ট", en: "Merchant" },
  savings: { bn: "সঞ্চয়ী", en: "Savings" },
  current: { bn: "চলতি", en: "Current" },
};

export function donationMethodDetails(method: DonationMethod, lang: string): string {
  const bn = lang === "bn";
  const lines: string[] = [];
  if (method.accountType) lines.push(`${bn ? "অ্যাকাউন্টের ধরন" : "Account type"}: ${donationAccountTypes[method.accountType][bn ? "bn" : "en"]}`);
  if (method.type === "bank") {
    if (method.bankName) lines.push(`${bn ? "ব্যাংক" : "Bank"}: ${method.bankName}`);
    if (method.branchName) lines.push(`${bn ? "শাখা" : "Branch"}: ${method.branchName}`);
    if (method.routingNumber) lines.push(`${bn ? "রাউটিং" : "Routing"}: ${method.routingNumber}`);
  }
  // Older saved descriptions remain visible, without duplicating a recognized wallet type.
  if (method.details && (!method.accountType || !/^(personal|merchant|পার্সোনাল|মার্চেন্ট)(\s+account|\s+অ্যাকাউন্ট)?$/i.test(method.details.trim()))) lines.push(method.details);
  return lines.join("\n");
}

export type DonationDemoContent = { title: string; description: string; instructions: string; isPublished?: 0 | 1 };

export type DonationConfig = {
  published: boolean;
  title: string;
  description: string;
  instructions: string;
  contactPhone: string;
  checkoutUrl: string;
  methods: DonationMethod[];
};

export const emptyDonationConfig: DonationConfig = {
  published: false, title: "", description: "", instructions: "",
  contactPhone: "", checkoutUrl: "", methods: [],
};

export const donationMethodLabels = {
  bkash: { bn: "বিকাশ", en: "bKash" },
  nagad: { bn: "নগদ", en: "Nagad" },
  rocket: { bn: "রকেট", en: "Rocket" },
  bank: { bn: "ব্যাংক", en: "Bank transfer" },
};
