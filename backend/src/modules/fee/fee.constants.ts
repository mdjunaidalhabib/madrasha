export const FEE_FREQUENCIES = ["ONE_TIME", "MONTHLY", "YEARLY"] as const;
export const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "BANK", "ONLINE"] as const;
export const PAYMENT_METHOD_TYPES = ["CASH", "BKASH", "NAGAD", "BANK", "OTHER"] as const;

/** Default OTHER category name - used whenever a fee structure's fee_type
 * is omitted (see FeeService.createStructure). Kept as its own constant
 * since it also has to match the "OTHER" row FEE_CATEGORY_DEFAULTS seeds. */
export const DEFAULT_FEE_CATEGORY_NAME = "অন্যান্য";

/** Starter ফি ধরণ picklist, lazily seeded into a tenant's own FeeCategory
 * rows the first time anything needs one and none exist yet - see
 * FeeRepository.seedDefaultCategories/FeeService.getCategories, same "seed
 * once, then let the admin freely edit" pattern as account.constants.ts's
 * DEFAULT_INCOME_FUNDS/DEFAULT_EXPENSE_GROUPS. `isAdmissionType` replaces
 * the old hardcoded FeeType.ADMISSION enum value - see FeeCategory in
 * fee.prisma. */
export const FEE_CATEGORY_DEFAULTS: Array<{ name: string; isAdmissionType: boolean }> = [
  { name: "ভর্তি ফি", isAdmissionType: true },
  { name: "মাসিক বেতন", isAdmissionType: false },
  { name: "পরীক্ষার ফি", isAdmissionType: false },
  { name: "বোর্ডিং ফি", isAdmissionType: false },
  { name: DEFAULT_FEE_CATEGORY_NAME, isAdmissionType: false },
];
