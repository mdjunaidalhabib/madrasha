import { NotificationChannel } from "@prisma/client";

export type BillingChannel = NotificationChannel; // "SMS" | "EMAIL"

export const BILLING_CHANNELS: BillingChannel[] = ["SMS", "EMAIL"];

export const isBillingChannel = (value: unknown): value is BillingChannel =>
  value === "SMS" || value === "EMAIL";

export type PerformedByType = "SUPER_ADMIN" | "ADMIN" | "SYSTEM";

export interface SubscriptionSummaryDto {
  channel: BillingChannel;
  active: boolean;
  packageId: number | null;
  packageName: string | null;
  startDate: Date | null;
  expiryDate: Date | null;
  totalCredit: number;
  usedCredit: number;
  remainingCredit: number;
  isLowCredit: boolean;
}
