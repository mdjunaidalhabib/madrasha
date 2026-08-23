import api, { cachedGet } from "./adminApi";

export type BillingChannel = "SMS" | "EMAIL";
export type PackageType = "PACKAGE" | "RECHARGE";

export type MessagePackage = {
  id: number;
  channel: BillingChannel;
  type: PackageType;
  name: string;
  description?: string | null;
  price: string;
  currency: string;
  credit: number;
  validityDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChannelPricing = {
  channel: BillingChannel;
  sellingPrice: string;
  providerCost: string;
  lowCreditThreshold: number;
};

export type PurchaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PurchaseRequest = {
  id: number;
  channel: BillingChannel;
  status: PurchaseRequestStatus;
  amount: string;
  paymentMethodLabel: string;
  transactionRef?: string | null;
  note?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  madrasa: { id: number; name: string; slug: string };
  package: { id: number; name: string; channel: BillingChannel; type: PackageType };
};

export type BillingReport = {
  channel: BillingChannel;
  totalSold: number;
  totalUsed: number;
  totalRemaining: number;
  revenue: string;
  providerCostTotal: string;
  profit: string;
  today: { count: number; credit: number; cost: string };
  month: { count: number; credit: number; cost: string };
  lowCreditMadrasas: { madrasaId: number; name: string; slug: string; remainingCredit: number }[];
  expiredCount: number;
  activeSubscriptions: number;
};

const BASE = "/super/message-billing";

/* =========================
   PACKAGES
========================= */

export async function listPackages(channel?: BillingChannel) {
  const res = await cachedGet(`${BASE}/packages`, { params: channel ? { channel } : undefined });
  return res.data;
}

export async function createPackage(payload: {
  channel: BillingChannel;
  type?: PackageType;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  credit: number;
  validityDays: number;
}) {
  const res = await api.post(`${BASE}/packages`, payload);
  return res.data;
}

export async function updatePackage(
  id: number,
  payload: Partial<{
    channel: BillingChannel;
    type: PackageType;
    name: string;
    description: string;
    price: number;
    currency: string;
    credit: number;
    validityDays: number;
  }>,
) {
  const res = await api.put(`${BASE}/packages/${id}`, payload);
  return res.data;
}

export async function togglePackage(id: number) {
  const res = await api.patch(`${BASE}/packages/${id}/toggle`);
  return res.data;
}

export async function deletePackage(id: number) {
  const res = await api.delete(`${BASE}/packages/${id}`);
  return res.data;
}

/* =========================
   PRICING
========================= */

export async function listPricing() {
  const res = await cachedGet(`${BASE}/pricing`);
  return res.data;
}

export async function updatePricing(
  channel: BillingChannel,
  payload: Partial<{ sellingPrice: number; providerCost: number; lowCreditThreshold: number }>,
) {
  const res = await api.put(`${BASE}/pricing/${channel}`, payload);
  return res.data;
}

export async function setMadrasaPricingOverride(
  channel: BillingChannel,
  madrasaId: number,
  sellingPrice: number,
) {
  const res = await api.put(`${BASE}/pricing/${channel}/madrasas/${madrasaId}`, { sellingPrice });
  return res.data;
}

export async function deleteMadrasaPricingOverride(channel: BillingChannel, madrasaId: number) {
  const res = await api.delete(`${BASE}/pricing/${channel}/madrasas/${madrasaId}`);
  return res.data;
}

/* =========================
   PURCHASE REQUESTS
========================= */

export async function listPurchaseRequests(params?: {
  status?: PurchaseRequestStatus;
  limit?: number;
}) {
  const res = await cachedGet(`${BASE}/purchase-requests`, { params });
  return res.data;
}

export async function approvePurchaseRequest(id: number, reviewNote?: string) {
  const res = await api.post(`${BASE}/purchase-requests/${id}/approve`, { reviewNote });
  return res.data;
}

export async function rejectPurchaseRequest(id: number, reviewNote?: string) {
  const res = await api.post(`${BASE}/purchase-requests/${id}/reject`, { reviewNote });
  return res.data;
}

/* =========================
   MADRASA BILLING (support/inspect + manual credit)
========================= */

export async function manualCredit(
  madrasaId: number,
  payload: { channel: BillingChannel; delta: number; note?: string },
) {
  const res = await api.post(`${BASE}/madrasas/${madrasaId}/manual-credit`, payload);
  return res.data;
}

export async function getMadrasaBillingSubscriptions(madrasaId: number) {
  const res = await cachedGet(`${BASE}/madrasas/${madrasaId}/subscriptions`);
  return res.data;
}

export async function getMadrasaBillingUsage(madrasaId: number) {
  const res = await cachedGet(`${BASE}/madrasas/${madrasaId}/usage`);
  return res.data;
}

export async function getMadrasaBillingTransactions(madrasaId: number) {
  const res = await cachedGet(`${BASE}/madrasas/${madrasaId}/transactions`);
  return res.data;
}

/* =========================
   REPORTS
========================= */

export async function getBillingReport(channel: BillingChannel) {
  const res = await cachedGet(`${BASE}/reports`, { params: { channel } });
  return res.data;
}
