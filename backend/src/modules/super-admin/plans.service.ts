import { Prisma } from "@prisma/client";
import { BadRequestError } from "../../shared/errors";
import { plansRepository, PlansRepository } from "./plans.repository";
import { CreatePlanRequestDto, ListPlansQueryDto } from "./plans.dto";
import { InvalidPlanIdError, PlanConflictError, PlanNotFoundError } from "./plans.types";

const num = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const bool01 = (v: unknown) => (v ? 1 : 0);

const validatePlanFields = (name: string, student_limit: number, user_limit: number, duration_days: number, price: number) => {
  if (!name) throw new BadRequestError("Plan নাম দিতে হবে");
  if (student_limit < 0) throw new BadRequestError("Student limit 0 বা তার বেশি হতে হবে");
  if (user_limit < 0) throw new BadRequestError("User limit 0 বা তার বেশি হতে হবে");
  if (duration_days <= 0) throw new BadRequestError("Duration days 1 বা তার বেশি হতে হবে");
  if (price < 0) throw new BadRequestError("Price 0 বা তার বেশি হতে হবে");
};

export class PlansService {
  constructor(private readonly repository: PlansRepository = plansRepository) {}

  listPlans(query: ListPlansQueryDto) {
    const q = String(query.q || "").trim();
    const active = String(query.active || "all");

    const where: Prisma.PlanWhereInput = { deletedAt: null };
    if (q) where.name = { contains: q };
    if (active !== "all") where.isActive = active === "1" ? 1 : 0;

    return this.repository.findMany(where);
  }

  listTrash() {
    return this.repository.findTrashed();
  }

  async createPlan(dto: CreatePlanRequestDto) {
    const name = String(dto.name || "").trim();
    const student_limit = num(dto.student_limit);
    const user_limit = num(dto.user_limit);
    const duration_days = num(dto.duration_days, 365);
    const price = num(dto.price);
    const is_active = bool01(dto.is_active ?? 1);

    validatePlanFields(name, student_limit, user_limit, duration_days, price);

    const exist = await this.repository.findActiveByName(name);
    if (exist) throw new PlanConflictError("এই নামে plan ইতিমধ্যে আছে");

    const created = await this.repository.create({
      name,
      studentLimit: student_limit,
      userLimit: user_limit,
      durationDays: duration_days,
      price,
      isActive: is_active,
    });

    return created.id;
  }

  async updatePlan(id: number, dto: CreatePlanRequestDto) {
    if (!id) throw new InvalidPlanIdError();

    const name = String(dto.name || "").trim();
    const student_limit = num(dto.student_limit);
    const user_limit = num(dto.user_limit);
    const duration_days = num(dto.duration_days);
    const price = num(dto.price);
    const is_active = bool01(dto.is_active ?? 1);

    validatePlanFields(name, student_limit, user_limit, duration_days, price);

    const result = await this.repository.updateActiveById(id, {
      name,
      studentLimit: student_limit,
      userLimit: user_limit,
      durationDays: duration_days,
      price,
      isActive: is_active,
    });

    if (result.count === 0) throw new PlanNotFoundError("Plan পাওয়া যায়নি / trash এ আছে");
  }

  async togglePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    const plan = await this.repository.findActiveById(id);
    if (!plan) throw new PlanNotFoundError("Plan পাওয়া যায়নি / trash এ আছে");

    await this.repository.updateById(id, { isActive: plan.isActive === 1 ? 0 : 1 });
  }

  private async hasRunningSubscription(planId: number) {
    const total = await this.repository.countRunningSubscriptions(planId);
    return total > 0;
  }

  async deletePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    if (await this.hasRunningSubscription(id)) {
      throw new PlanConflictError(
        "এই plan বর্তমানে running subscription-এ ব্যবহৃত হচ্ছে। ডিলিট না করে Inactive করুন।",
      );
    }

    const result = await this.repository.softDelete(id);
    if (result.count === 0) throw new PlanNotFoundError("Plan পাওয়া যায়নি / আগেই trash এ");
  }

  async restorePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    const result = await this.repository.restore(id);
    if (result.count === 0) throw new PlanNotFoundError("Plan trash এ নেই / পাওয়া যায়নি");
  }

  async permanentDeletePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    if (await this.hasRunningSubscription(id)) {
      throw new PlanConflictError(
        "এই plan বর্তমানে running subscription-এ ব্যবহৃত হচ্ছে। Permanent delete করা যাবে না।",
      );
    }

    const result = await this.repository.permanentDelete(id);
    if (result.count === 0) throw new PlanNotFoundError("Plan trash এ নেই / পাওয়া যায়নি");
  }
}

export const plansService = new PlansService();
