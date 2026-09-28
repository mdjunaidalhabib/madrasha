import { Prisma } from "@prisma/client";
import { BadRequestError } from "../../shared/errors";
import { plansRepository, PlansRepository } from "./plans.repository";
import { CreatePlanRequestDto, ListPlansQueryDto } from "./plans.dto";
import { InvalidPlanIdError, PlanConflictError, PlanNotFoundError } from "./plans.types";
import { t } from "../../shared/i18n";

const num = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const bool01 = (v: unknown) => (v ? 1 : 0);

const validatePlanFields = (name: string, student_limit: number, user_limit: number, duration_days: number, price: number) => {
  if (!name) throw new BadRequestError(t({ bn: "প্ল্যানের নাম দিতে হবে", en: "Plan name is required" }));
  if (student_limit < 0) throw new BadRequestError(t({ bn: "শিক্ষার্থী সীমা 0 বা তার বেশি হতে হবে", en: "Student limit must be 0 or more" }));
  if (user_limit < 0) throw new BadRequestError(t({ bn: "ব্যবহারকারী সীমা 0 বা তার বেশি হতে হবে", en: "User limit must be 0 or more" }));
  if (duration_days <= 0) throw new BadRequestError(t({ bn: "মেয়াদ (দিন) 1 বা তার বেশি হতে হবে", en: "Duration days must be 1 or more" }));
  if (price < 0) throw new BadRequestError(t({ bn: "মূল্য 0 বা তার বেশি হতে হবে", en: "Price must be 0 or more" }));
};

/** null = not sent (leave unchanged). Sizes of 0/empty are dropped. */
const parseRegBlockSizes = (dto: CreatePlanRequestDto) => {
  if (!Array.isArray(dto.reg_block_sizes)) return null;
  const rows: { divisionId: number; blockSize: number }[] = [];
  for (const item of dto.reg_block_sizes) {
    const divisionId = Number(item?.division_id);
    const blockSize = num(item?.block_size);
    if (!divisionId) continue;
    if (!Number.isInteger(blockSize) || blockSize < 0 || blockSize > 100_000) {
      throw new BadRequestError(t({ bn: "রেজি. ব্লকের সাইজ 0 থেকে 100000 এর মধ্যে পূর্ণসংখ্যা হতে হবে", en: "Registration block size must be a whole number between 0 and 100000" }));
    }
    if (blockSize > 0) rows.push({ divisionId, blockSize });
  }
  return rows;
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
    const regBlocks = parseRegBlockSizes(dto);

    const exist = await this.repository.findActiveByName(name);
    if (exist) throw new PlanConflictError(t({ bn: "এই নামে প্ল্যান ইতিমধ্যে আছে", en: "A plan with this name already exists" }));

    try {
      const created = await this.repository.create({
        name,
        studentLimit: student_limit,
        userLimit: user_limit,
        durationDays: duration_days,
        price,
        isActive: is_active,
      });

      if (regBlocks) await this.repository.replaceRegBlocks(created.id, regBlocks);

      return created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new PlanConflictError(t({ bn: "এই নামে প্ল্যান আগে ব্যবহার হয়েছে (ট্র্যাশেও থাকতে পারে), অন্য নাম দিন", en: "This plan name has been used before (it may be in the trash), choose another name" }));
      }
      throw err;
    }
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
    const regBlocks = parseRegBlockSizes(dto);

    const exist = await this.repository.findActiveByNameExcludingId(name, id);
    if (exist) throw new PlanConflictError(t({ bn: "এই নামে প্ল্যান ইতিমধ্যে আছে", en: "A plan with this name already exists" }));

    let result;
    try {
      result = await this.repository.updateActiveById(id, {
        name,
        studentLimit: student_limit,
        userLimit: user_limit,
        durationDays: duration_days,
        price,
        isActive: is_active,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new PlanConflictError(t({ bn: "এই নামে প্ল্যান আগে ব্যবহার হয়েছে (ট্র্যাশেও থাকতে পারে), অন্য নাম দিন", en: "This plan name has been used before (it may be in the trash), choose another name" }));
      }
      throw err;
    }

    if (result.count === 0) throw new PlanNotFoundError(t({ bn: "প্ল্যান পাওয়া যায়নি / ট্র্যাশে আছে", en: "Plan not found / it is in the trash" }));

    // Only affects blocks laid out from now on - madrasas' existing blocks
    // are never resized by a plan edit.
    if (regBlocks) await this.repository.replaceRegBlocks(id, regBlocks);
  }

  async togglePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    const plan = await this.repository.findActiveById(id);
    if (!plan) throw new PlanNotFoundError(t({ bn: "প্ল্যান পাওয়া যায়নি / ট্র্যাশে আছে", en: "Plan not found / it is in the trash" }));

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
        t({ bn: "এই প্ল্যান বর্তমানে চলমান সাবস্ক্রিপশনে ব্যবহৃত হচ্ছে। ডিলিট না করে নিষ্ক্রিয় করুন।", en: "This plan is used by a running subscription. Deactivate it instead of deleting." }),
      );
    }

    const result = await this.repository.softDelete(id);
    if (result.count === 0) throw new PlanNotFoundError(t({ bn: "প্ল্যান পাওয়া যায়নি / আগেই ট্র্যাশে", en: "Plan not found / already in the trash" }));
  }

  async restorePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    const result = await this.repository.restore(id);
    if (result.count === 0) throw new PlanNotFoundError(t({ bn: "প্ল্যান ট্র্যাশে নেই / পাওয়া যায়নি", en: "Plan is not in the trash / not found" }));
  }

  async permanentDeletePlan(id: number) {
    if (!id) throw new InvalidPlanIdError();

    if (await this.hasRunningSubscription(id)) {
      throw new PlanConflictError(
        t({ bn: "এই প্ল্যান বর্তমানে চলমান সাবস্ক্রিপশনে ব্যবহৃত হচ্ছে। স্থায়ীভাবে মুছে ফেলা যাবে না।", en: "This plan is used by a running subscription. It cannot be permanently deleted." }),
      );
    }

    const result = await this.repository.permanentDelete(id);
    if (result.count === 0) throw new PlanNotFoundError(t({ bn: "প্ল্যান ট্র্যাশে নেই / পাওয়া যায়নি", en: "Plan is not in the trash / not found" }));
  }
}

export const plansService = new PlansService();
