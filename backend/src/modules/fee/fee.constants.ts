export const FEE_FREQUENCIES = ["ONE_TIME", "MONTHLY", "YEARLY"] as const;
export const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "BANK", "ONLINE"] as const;
export const PAYMENT_METHOD_TYPES = ["CASH", "BKASH", "NAGAD", "BANK", "OTHER"] as const;

// Category used when a fee payment is auto-logged into the existing
// accounts/ledger module (see fee.service.ts recordPayment()).
export const FEE_ACCOUNT_CATEGORY = "Student Fee";
export const FEE_ACCOUNT_FUND = "General";
