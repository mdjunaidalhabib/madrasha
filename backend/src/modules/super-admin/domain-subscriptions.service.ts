import { z } from "zod";
import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { CUSTOM_DOMAIN_PRICES } from "../../shared/subscription/subscription.constants";
import { subscriptionsRepository } from "./subscriptions.repository";
import { DomainSubscriptionsRepository } from "./domain-subscriptions.repository";
import { DomainSubscriptionDto } from "./domain-subscriptions.dto";
import { dateOnly } from "./subscriptions.service";
import { MADRASA_ACTIVITY } from "./superadmin.constants";

const schema = z
  .object({
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .max(190)
      .regex(/^(?=.{1,190}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
    amountPaid: z.coerce.number().finite().min(0).max(99_999_999),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isActive: z.union([z.literal(0), z.literal(1)]),
    registeredInNameOf: z.enum(["institution", "platform"]),
  })
  .refine((d) => d.endDate >= d.startDate);

export class DomainSubscriptionsService {
  constructor(private readonly repository = new DomainSubscriptionsRepository()) {}
  async list(madrasaId: number) {
    const rows = await this.repository.list(madrasaId);
    return rows.map((row) => ({
      ...row,
      amountPaid: Number(row.amountPaid),
      expired: +row.endDate + 86400000 <= Date.now(),
    }));
  }
  async save(madrasaId: number, dto: DomainSubscriptionDto, id?: number) {
    try {
      return await this.repository.transaction(async (tx) => {
        if (!(await subscriptionsRepository.lock(tx, madrasaId))) throw new NotFoundError();
        const existing = id ? await this.repository.find(tx, madrasaId, id) : null;
        if (id && !existing) throw new NotFoundError();
        const domain = String(dto.domain ?? existing?.domain ?? "")
          .trim()
          .toLowerCase();
        const previous = await this.repository.history(tx, madrasaId, domain);
        const startDate = dto.startDate ?? existing?.startDate ?? dateOnly(new Date());
        const amountPaid =
          dto.amountPaid ??
          existing?.amountPaid ??
          (domain.endsWith(".com")
            ? previous
              ? CUSTOM_DOMAIN_PRICES.renewal
              : CUSTOM_DOMAIN_PRICES.firstYear
            : undefined);
        const result = schema.safeParse({
          domain,
          amountPaid,
          startDate,
          endDate:
            dto.endDate ?? existing?.endDate ?? new Date(+new Date(startDate) + 364 * 86400000),
          isActive: dto.isActive ?? existing?.isActive ?? 1,
          // DECISION: register the domain in the institution's name by default.
          registeredInNameOf:
            dto.registeredInNameOf ?? existing?.registeredInNameOf ?? "institution",
        });
        if (!result.success)
          throw new BadRequestError(
            t({
              bn: "ডোমেইন, মূল্য ও তারিখ সঠিকভাবে দিন। অন্য টিএলডির মূল্য হাতে দিতে হবে।",
              en: "Check domain, amount and dates. Other TLDs require a manual amount.",
            }),
          );
        const data = { ...result.data, amountPaid: Math.ceil(result.data.amountPaid) };
        const row = id
          ? await this.repository.update(tx, id, data)
          : await this.repository.create(tx, { ...data, madrasaId });
        if (row.isActive === 1) await this.repository.connect(tx, madrasaId, row.domain);
        // Expiry and deactivation never automatically disconnect a domain.
        await subscriptionsRepository.log(
          tx,
          madrasaId,
          MADRASA_ACTIVITY.DOMAIN_UPDATED,
          row.id,
          JSON.stringify({ domain, amountPaid: data.amountPaid }),
        );
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new BadRequestError(
          t({
            bn: "ডোমেইনটি অন্য প্রতিষ্ঠানে যুক্ত আছে।",
            en: "This domain is connected to another institution.",
          }),
        );
      throw error;
    }
  }
  async remove(madrasaId: number, id: number) {
    return this.repository.transaction(async (tx) => {
      if (!(await subscriptionsRepository.lock(tx, madrasaId))) throw new NotFoundError();
      const row = await this.repository.find(tx, madrasaId, id);
      if (!row) throw new NotFoundError();
      await this.repository.update(tx, id, { isActive: 0 });
      // Explicit owner removal only. Keep the payment/expiry record for audit.
      await this.repository.disconnect(tx, madrasaId, row.domain);
      await subscriptionsRepository.log(
        tx,
        madrasaId,
        MADRASA_ACTIVITY.DOMAIN_UPDATED,
        id,
        "Domain manually disconnected",
      );
    });
  }
}
export const domainSubscriptionsService = new DomainSubscriptionsService();
