import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { importantLinkRepository, ImportantLinkRepository } from "./important-link.repository";
import {
  CreateImportantLinkRequestDto,
  UpdateImportantLinkRequestDto,
} from "./important-link.dto";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

export class ImportantLinkService {
  constructor(private readonly repository: ImportantLinkRepository = importantLinkRepository) {}

  async list() {
    const rows = await this.repository.findMany();
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      sub_label: r.subLabel,
      url: r.url,
      is_active: r.isActive,
    }));
  }

  /** Active links only, for the tenant Dashboard's "গুরুত্বপূর্ণ লিংক" card. */
  async listActive() {
    const rows = await this.repository.findActive();
    return rows.map((r) => ({ id: r.id, label: r.label, sub_label: r.subLabel, url: r.url }));
  }

  async create(dto: CreateImportantLinkRequestDto) {
    if (isEmpty(dto.label) || isEmpty(dto.url)) {
      throw new BadRequestError("label এবং url আবশ্যক");
    }

    const maxOrder = await this.repository.findMaxSortOrder();
    return this.repository.create({
      label: String(dto.label).trim(),
      subLabel: dto.sub_label?.trim() || null,
      url: String(dto.url).trim(),
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    });
  }

  async update(id: number, dto: UpdateImportantLinkRequestDto) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("লিংক পাওয়া যায়নি");

    const data: Prisma.ImportantLinkUpdateInput = {};
    if (dto.label !== undefined) {
      if (isEmpty(dto.label)) throw new BadRequestError("label খালি রাখা যাবে না");
      data.label = String(dto.label).trim();
    }
    if (dto.sub_label !== undefined) data.subLabel = dto.sub_label?.trim() || null;
    if (dto.url !== undefined) {
      if (isEmpty(dto.url)) throw new BadRequestError("url খালি রাখা যাবে না");
      data.url = String(dto.url).trim();
    }
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    await this.repository.update(id, data);
  }

  async delete(id: number) {
    try {
      await this.repository.delete(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError("লিংক পাওয়া যায়নি");
      }
      throw err;
    }
  }

  async reorder(orderedIds: number[]) {
    const rows = await this.repository.findAllIds();
    const allIds = rows.map((r) => r.id);
    const sameSet = allIds.length === orderedIds.length && allIds.every((id) => orderedIds.includes(id));
    if (!sameSet) throw new BadRequestError("link_ids must match every existing link exactly");

    await this.repository.reorder(orderedIds);
  }
}

export const importantLinkService = new ImportantLinkService();
