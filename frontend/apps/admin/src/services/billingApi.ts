import api from "./api";

/**
 * Billing API bindings: SMS/Email package & credit billing system.
 */

export type BillingChannel = "SMS" | "EMAIL";
export type PackageType = "PACKAGE" | "RECHARGE";
export type PurchaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BillingTransactionType =
  | "PACKAGE_PURCHASE"
  | "RECHARGE"
  | "RENEWAL"
  | "USAGE"
  | "REFUND"
  | "MANUAL_CREDIT"
  | "MANUAL_DEDUCTION";
export type MessageUsageStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "REJECTED";
export type SmsEncoding = "GSM_7" | "UNICODE";

export interface MessagePackage {
  id: number;
  channel: BillingChannel;
  type: PackageType;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  credit: number;
  validityDays: number;
  isActive: boolean;
}

export interface SubscriptionSummaryDto {
  channel: BillingChannel;
  active: boolean;
  packageId: number | null;
  packageName: string | null;
  startDate: string | null;
  expiryDate: string | null;
  totalCredit: number;
  usedCredit: number;
  remainingCredit: number;
  isLowCredit: boolean;
}

export interface SmsPreviewResult {
  encoding: SmsEncoding;
  characterCount: number;
  effectiveLength: number;
  segmentCount: number;
  pricePerSegment: string;
  estimatedCost: string;
  remainingCredit: number;
}

export interface BillingTransaction {
  id: number;
  channel: BillingChannel;
  type: BillingTransactionType;
  packageId: number | null;
  amount: string | null;
  creditDelta: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  package: { id: number; name: string } | null;
}

export interface MessageUsageLog {
  id: number;
  channel: BillingChannel;
  recipient: string;
  encoding: SmsEncoding | null;
  characterCount: number | null;
  segmentCount: number | null;
  pricePerUnit: string;
  totalCost: string;
  creditUsed: number;
  provider: string | null;
  providerMessageId: string | null;
  status: MessageUsageStatus;
  failureReason: string | null;
  createdAt: string;
}

export interface MessagePurchaseRequest {
  id: number;
  channel: BillingChannel;
  status: PurchaseRequestStatus;
  amount: string;
  paymentMethodLabel: string | null;
  transactionRef: string | null;
  note: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  package: { id: number; name: string; channel: BillingChannel; type: PackageType } | null;
}

export const billingApi = {
  getPackages: (channel: BillingChannel) =>
    api.get<{ data: MessagePackage[] }>("/billing/packages", { params: { channel } }),

  getSubscriptions: () => api.get<{ data: SubscriptionSummaryDto[] }>("/billing/subscriptions"),

  getSubscription: (channel: BillingChannel) =>
    api.get<{ data: SubscriptionSummaryDto }>("/billing/subscription", { params: { channel } }),

  previewSms: (message: string) =>
    api.post<{ data: SmsPreviewResult }>("/billing/sms/preview", { message }),

  getTransactions: (params?: { channel?: BillingChannel; limit?: number }) =>
    api.get<{ data: BillingTransaction[] }>("/billing/transactions", { params }),

  getUsage: (params?: { channel?: BillingChannel; limit?: number }) =>
    api.get<{ data: MessageUsageLog[] }>("/billing/usage", { params }),

  createPurchaseRequest: (payload: {
    channel: BillingChannel;
    packageId: number;
    paymentMethodLabel?: string;
    transactionRef?: string;
    note?: string;
  }) => api.post<{ data: MessagePurchaseRequest }>("/billing/purchase-requests", payload),

  getPurchaseRequests: (params?: { limit?: number }) =>
    api.get<{ data: MessagePurchaseRequest[] }>("/billing/purchase-requests", { params }),
};
