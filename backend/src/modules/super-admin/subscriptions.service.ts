import { BadRequestError, NotFoundError } from "../../shared/errors";
import { TransactionClient } from "../../shared/database/transaction";
import { settingsRepository } from "../settings/settings.repository";
import { t } from "../../shared/i18n";
import { invalidateSubscriptionCache } from "../../shared/subscription/subscription-state";
import {
  isRefundEligible,
  pickPlanForStudents,
  priceForCycle,
  renewalTerms,
} from "../../shared/subscription/subscription-pricing";
import { DATA_RETENTION_WARNING_DAYS } from "../../shared/subscription/subscription.constants";
import { MADRASA_ACTIVITY } from "./superadmin.constants";
import { SubscriptionPurchaseDto } from "./subscriptions.dto";
import { subscriptionsRepository, SubscriptionsRepository } from "./subscriptions.repository";
import { z } from "zod";

const purchaseSchema = z.object({
  plan_id: z.coerce.number().int().positive().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  custom_amount: z.coerce.number().finite().min(0).max(99_999_999).optional(),
  payment_method: z.string().trim().min(1).max(50).optional(),
  transaction_id: z.string().trim().max(100).optional(),
});

const DAY = 86_400_000;
export const dateOnly = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export class SubscriptionsService {
  constructor(private readonly repository: SubscriptionsRepository = subscriptionsRepository) {}

  async purchaseOnTx(tx: TransactionClient, madrasaId: number, dto: SubscriptionPurchaseDto) {
    const parsed = purchaseSchema.safeParse(dto);
    if (!parsed.success)
      throw new BadRequestError(
        t({ bn: "পেমেন্ট ও প্ল্যানের তথ্য সঠিক নয়।", en: "Invalid payment or plan details." }),
      );
    dto = parsed.data;
    const madrasa = await this.repository.lock(tx, madrasaId);
    if (!madrasa)
      throw new NotFoundError(t({ bn: "প্রতিষ্ঠান পাওয়া যায়নি", en: "Institution not found" }));
    const previous = await this.repository.latest(tx, madrasaId);
    const plans = await this.repository.plans(tx);
    const students = await settingsRepository.countActiveStudents(madrasaId, tx);
    const cycle = previous ? "RENEWAL" : "FIRST";
    const fitting = pickPlanForStudents(plans, students);
    let plan =
      cycle === "FIRST"
        ? plans.find((p) => p.id === Number(dto.plan_id))
        : fitting === "CUSTOM"
          ? undefined
          : fitting;
    if (cycle === "RENEWAL" && fitting === "CUSTOM") {
      plan = plans.find((p) => p.id === Number(dto.plan_id) && p.studentLimit >= students);
    }
    if (!plan || (fitting === "CUSTOM" && plan.studentLimit < students))
      throw new BadRequestError(
        t({
          bn: "উপযুক্ত প্ল্যান ও কাস্টম মূল্যের জন্য সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।",
          en: "Select a fitting plan; Custom pricing must be entered manually by the super admin.",
        }),
      );
    let amount = priceForCycle(plan, cycle);
    if (fitting === "CUSTOM") {
      amount = Number(dto.custom_amount);
      if (!Number.isFinite(amount) || amount < 0)
        throw new BadRequestError(
          t({ bn: "কাস্টম মূল্য দিন।", en: "A negotiated Custom amount is required." }),
        );
    }
    const now = dateOnly(new Date());
    let startDate = dto.start_date ? new Date(dto.start_date) : now;
    if (
      Number.isNaN(+startDate) ||
      (dto.start_date && startDate.toISOString().slice(0, 10) !== dto.start_date)
    )
      throw new BadRequestError(t({ bn: "শুরুর তারিখ সঠিক নয়।", en: "Invalid start date." }));
    startDate = dateOnly(startDate);
    let endDate: Date;
    const duration = plan.durationDays ?? 365;
    if (previous?.endDate) {
      const terms = renewalTerms({ endDate: previous.endDate, now });
      amount += terms.lateFee;
      const anchored = +terms.extendsFrom === +previous.endDate;
      startDate = anchored ? new Date(+previous.endDate + DAY) : now;
      endDate = new Date(+startDate + (duration - 1) * DAY);
    } else endDate = new Date(+startDate + (duration - 1) * DAY);
    amount = Math.ceil(amount);
    await this.repository.deactivate(tx, madrasaId);
    const subscription = await this.repository.create(tx, {
      madrasaId,
      planId: plan.id,
      startDate,
      endDate,
      cycle,
      pricePaid: amount,
      studentLimitAtStart: plan.studentLimit,
      isActive: 1,
    });
    await this.repository.payment(tx, {
      madrasaId,
      subscriptionId: subscription.id,
      amount,
      status: "paid",
      paymentMethod: dto.payment_method || "manual",
      transactionId: dto.transaction_id || null,
    });
    await this.repository.activate(tx, madrasaId, plan.studentLimit);
    await this.repository.log(
      tx,
      madrasaId,
      MADRASA_ACTIVITY.SUBSCRIPTION_PURCHASED,
      subscription.id,
      JSON.stringify({ cycle, amount, planId: plan.id }),
    );
    return subscription;
  }

  async purchase(madrasaId: number, dto: SubscriptionPurchaseDto) {
    const result = await this.repository.transaction((tx) => this.purchaseOnTx(tx, madrasaId, dto));
    invalidateSubscriptionCache(madrasaId);
    return result;
  }

  async cancelAndRefund(madrasaId: number, id: number) {
    const result = await this.repository.transaction(async (tx) => {
      if (!(await this.repository.lock(tx, madrasaId))) throw new NotFoundError();
      const subscription = await this.repository.refundRecord(tx, madrasaId, id);
      const first = await this.repository.firstPurchase(tx, madrasaId);
      const now = new Date();
      if (
        !subscription ||
        !subscription.isActive ||
        subscription.cancelledAt ||
        subscription.refundedAt ||
        first?.id !== id ||
        !subscription.startDate ||
        !isRefundEligible({ startDate: subscription.startDate, now, cycle: subscription.cycle })
      ) {
        throw new BadRequestError(
          t({
            bn: "শুধু প্রথম ক্রয়ের ৩০ দিনের মধ্যে একবার ফেরত দেওয়া যায়।",
            en: "A refund is available once, within 30 days of the first purchase only.",
          }),
        );
      }
      const amount =
        subscription.pricePaid == null
          ? subscription.payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
          : Number(subscription.pricePaid);
      await this.repository.cancel(tx, id, amount, now);
      await this.repository.suspend(tx, madrasaId);
      await this.repository.log(
        tx,
        madrasaId,
        MADRASA_ACTIVITY.SUBSCRIPTION_REFUNDED,
        id,
        JSON.stringify({ refundAmount: amount }),
      );
      return {
        refundAmount: amount,
        message: t({
          bn: `৳${amount} ফেরত রেকর্ড করা হয়েছে। প্রতিষ্ঠান স্থগিত করা হয়েছে।`,
          en: `Refund of ৳${amount} recorded. The institution is suspended.`,
        }),
      };
    });
    invalidateSubscriptionCache(madrasaId);
    return result;
  }

  async listExpired() {
    const now = dateOnly(new Date());
    const rows = await this.repository.expiredCandidates();
    const expired = rows.flatMap((m) => {
      const end = m.subscriptions[0]?.endDate;
      const days = end ? Math.floor((+now - +end) / DAY) : 0;
      return end && days > DATA_RETENTION_WARNING_DAYS
        ? [{ id: m.id, name: m.name, endDate: end, daysSinceExpiry: days }]
        : [];
    });
    return Promise.all(
      expired.map(async (m) => ({
        ...m,
        studentCount: await settingsRepository.countActiveStudents(m.id),
      })),
    );
  }
}
export const subscriptionsService = new SubscriptionsService();
