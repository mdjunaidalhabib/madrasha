import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { FEE_FREQUENCIES } from "../fee/fee.constants";
import {
  defaultFeeStructureRepository,
  DefaultFeeStructureRepository,
} from "./default-fee-structure.repository";
import { CreateDefaultFeeStructureRequestDto, UpdateDefaultFeeStructureRequestDto } from "./default-fee-structure.dto";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0) throw new BadRequestError("amount must be a positive number");
  return amount;
};

/** Never shown to/set by the admin - only exists so seed.ts can idempotently
 * upsert its own baseline rows by a stable key without colliding with
 * whatever an admin creates through this UI. */
const generateKeyName = () => `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export class DefaultFeeStructureService {
  constructor(private readonly repository: DefaultFeeStructureRepository = defaultFeeStructureRepository) {}

  async list(classId?: number) {
    const rows = await this.repository.findMany(classId);
    return rows.map((r) => ({
      id: r.id,
      class_id: r.classId,
      class_label: r.class ? `${r.class.division?.nameBn ?? ""} - ${r.class.nameBn}`.replace(/^ - /, "") : null,
      division_label: r.class?.division?.nameBn ?? null,
      class_name: r.class?.nameBn ?? null,
      name: r.name,
      amount: r.amount,
      frequency: r.frequency,
      is_active: r.isActive,
    }));
  }

  async create(dto: CreateDefaultFeeStructureRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.amount) || isEmpty(dto.frequency)) {
      throw new BadRequestError("name, amount and frequency are required");
    }
    if (!FEE_FREQUENCIES.includes(dto.frequency as any)) {
      throw new BadRequestError("frequency must be ONE_TIME, MONTHLY or YEARLY");
    }
    const amount = toAmount(dto.amount);

    return this.repository.create({
      keyName: generateKeyName(),
      classId: dto.class_id ? Number(dto.class_id) : null,
      name: String(dto.name).trim(),
      amount,
      frequency: dto.frequency as any,
    });
  }

  async update(id: number, dto: UpdateDefaultFeeStructureRequestDto) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("ফি টেমপ্লেট পাওয়া যায়নি");

    const data: Prisma.DefaultFeeStructureUpdateInput = {};
    if (dto.name !== undefined) {
      if (isEmpty(dto.name)) throw new BadRequestError("name cannot be empty");
      data.name = String(dto.name).trim();
    }
    if (dto.amount !== undefined) data.amount = toAmount(dto.amount);
    if (dto.class_id !== undefined) data.class = dto.class_id ? { connect: { id: Number(dto.class_id) } } : { disconnect: true };
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);
    if (dto.frequency !== undefined) {
      if (!FEE_FREQUENCIES.includes(dto.frequency as any)) {
        throw new BadRequestError("frequency must be ONE_TIME, MONTHLY or YEARLY");
      }
      data.frequency = dto.frequency as any;
    }
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    await this.repository.update(id, data);
  }

  async delete(id: number) {
    try {
      await this.repository.delete(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError("ফি টেমপ্লেট পাওয়া যায়নি");
      }
      throw err;
    }
  }
}

export const defaultFeeStructureService = new DefaultFeeStructureService();
