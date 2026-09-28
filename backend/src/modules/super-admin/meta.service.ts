import { Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { metaRepository, MetaRepository } from "./meta.repository";
import { parseInstitutionType } from "../../shared/utils/institution.util";
import {
  CreateBookRequestDto,
  CreateClassRequestDto,
  CreateDivisionRequestDto,
  UpdateBookRequestDto,
  UpdateClassRequestDto,
  UpdateDivisionRequestDto,
} from "./meta.dto";
import { t } from "../../shared/i18n";

/** Deletes on this shared, global catalog can be blocked by real tenant
 * data (students/teachers/results/... all FK onto Class/Book with
 * onDelete: Restrict) - translate that DB-level protection into a message
 * an admin can act on instead of a raw 500. */
const isInUseError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2003" || err.code === "P2014");

export class MetaService {
  constructor(private readonly repository: MetaRepository = metaRepository) {}

  async listDivisions() {
    const rows = await this.repository.findDivisions();
    return rows.map((r) => ({
      id: r.id,
      key_name: r.keyName,
      name: r.name,
      label: r.nameBn,
      institution_type: r.institutionType,
    }));
  }

  async createDivision(dto: CreateDivisionRequestDto) {
    const nameBn = String(dto.name_bn || "").trim();
    if (!nameBn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn is required", ar: "name_bn مطلوب" }));

    const existing = await this.repository.findDivisionByNameBn(nameBn);
    if (existing) throw new ConflictError(t({ bn: "এই নামে বিভাগ ইতিমধ্যে আছে", en: "A division with this name already exists" }));

    const maxOrder = await this.repository.findMaxDivisionSortOrder();
    return this.repository.createDivision({
      name: dto.name?.trim() || null,
      nameBn,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      institutionType: parseInstitutionType(dto.institution_type) ?? "MADRASA",
    });
  }

  async reorderDivisions(orderedDivisionIds: number[]) {
    const rows = await this.repository.findAllDivisionIds();
    const allIds = rows.map((r) => r.id);
    const sameSet = allIds.length === orderedDivisionIds.length && allIds.every((id) => orderedDivisionIds.includes(id));
    if (!sameSet) throw new BadRequestError(t({ bn: "division_ids অবশ্যই বিদ্যমান সব বিভাগের সাথে হুবহু মিলতে হবে", en: "division_ids must match every existing division exactly" }));

    await this.repository.reorderDivisions(orderedDivisionIds);
  }

  async updateDivision(id: number, dto: UpdateDivisionRequestDto) {
    const nameBn = String(dto.name_bn || "").trim();
    if (!nameBn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn is required", ar: "name_bn مطلوب" }));

    try {
      await this.repository.updateDivision(id, nameBn, parseInstitutionType(dto.institution_type));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "বিভাগ পাওয়া যায়নি", en: "Division not found" }));
      }
      throw err;
    }
  }

  async deleteDivision(id: number) {
    try {
      await this.repository.deleteDivision(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "বিভাগ পাওয়া যায়নি", en: "Division not found" }));
      }
      if (isInUseError(err)) {
        throw new ConflictError(t({ bn: "এই বিভাগটি ব্যবহারে আছে (শ্রেণি/শিক্ষার্থী/শিক্ষক যুক্ত আছে), মুছে ফেলা যাবে না", en: "This division is in use (classes/students/teachers are linked) and cannot be deleted" }));
      }
      throw err;
    }
  }

  async listModules() {
    const rows = await this.repository.findActiveModules();
    return rows.map((r) => ({
      id: r.id,
      key_name: r.keyName,
      name: r.name,
      label: r.nameBn,
      group_name: r.groupName,
    }));
  }

  async listClasses(divisionId?: number, includeInactive = false) {
    const rows = await this.repository.findClasses(divisionId, includeInactive);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.nameBn,
      division_id: r.divisionId,
      is_active: r.isActive,
    }));
  }

  async createClass(dto: CreateClassRequestDto) {
    const divisionId = Number(dto.division_id);
    const nameBn = String(dto.name_bn || "").trim();
    if (!divisionId) throw new BadRequestError(t({ bn: "division_id আবশ্যক", en: "division_id is required", ar: "division_id مطلوب" }));
    if (!nameBn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn is required", ar: "name_bn مطلوب" }));

    const maxOrder = await this.repository.findMaxClassSortOrder(divisionId);

    try {
      return await this.repository.createClass({
        divisionId,
        name: dto.name?.trim() || null,
        nameBn,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(t({ bn: "এই বিভাগে এই নামে শ্রেণি ইতিমধ্যে আছে", en: "A class with this name already exists in this division" }));
      }
      throw err;
    }
  }

  async updateClass(id: number, dto: UpdateClassRequestDto) {
    const nameBn = String(dto.name_bn || "").trim();
    if (!nameBn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn is required", ar: "name_bn مطلوب" }));

    try {
      await this.repository.updateClass(id, nameBn);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "শ্রেণি পাওয়া যায়নি", en: "Class not found" }));
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(t({ bn: "এই বিভাগে এই নামে শ্রেণি ইতিমধ্যে আছে", en: "A class with this name already exists in this division" }));
      }
      throw err;
    }
  }

  async reorderClasses(divisionId: number, orderedClassIds: number[]) {
    if (!divisionId) throw new BadRequestError(t({ bn: "division_id আবশ্যক", en: "division_id is required", ar: "division_id مطلوب" }));
    const rows = await this.repository.findClassIdsByDivision(divisionId);
    const allIds = rows.map((r) => r.id);
    const sameSet = allIds.length === orderedClassIds.length && allIds.every((id) => orderedClassIds.includes(id));
    if (!sameSet) throw new BadRequestError(t({ bn: "class_ids অবশ্যই এই বিভাগের শ্রেণিগুলোর সাথে হুবহু মিলতে হবে", en: "class_ids must match this division's classes exactly" }));

    await this.repository.reorderClasses(divisionId, orderedClassIds);
  }

  async toggleClassActive(id: number, isActive: boolean) {
    try {
      await this.repository.toggleClassActive(id, isActive);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "শ্রেণি পাওয়া যায়নি", en: "Class not found" }));
      }
      throw err;
    }
  }

  async deleteClass(id: number) {
    try {
      await this.repository.deleteClass(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "শ্রেণি পাওয়া যায়নি", en: "Class not found" }));
      }
      if (isInUseError(err)) {
        throw new ConflictError(
          t({ bn: "এই শ্রেণিটি ব্যবহারে আছে (শিক্ষার্থী/শিক্ষক/রেজাল্ট যুক্ত আছে), মুছে ফেলা যাবে না — চাইলে নিষ্ক্রিয় করুন", en: "This class is in use (students/teachers/results are linked) and cannot be deleted — deactivate it instead" }),
        );
      }
      throw err;
    }
  }

  async listBooks(classId?: number) {
    const rows = await this.repository.findBooks(classId);
    return rows.map((r) => ({ id: r.id, name: r.name, label: r.nameBn, class_id: r.classId }));
  }

  async createBook(dto: CreateBookRequestDto) {
    const classId = Number(dto.class_id);
    const nameBn = String(dto.name_bn || "").trim();
    if (!classId) throw new BadRequestError(t({ bn: "class_id আবশ্যক", en: "class_id is required", ar: "class_id مطلوب" }));
    if (!nameBn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn is required", ar: "name_bn مطلوب" }));

    const existing = await this.repository.findBookByNameBn(classId, nameBn);
    if (existing) throw new ConflictError(t({ bn: "এই শ্রেণিতে এই নামে বিষয় ইতিমধ্যে আছে", en: "A subject with this name already exists in this class" }));

    const maxOrder = await this.repository.findMaxBookSortOrder(classId);

    try {
      return await this.repository.createBook({
        classId,
        name: dto.name?.trim() || null,
        nameBn,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(t({ bn: "এই শ্রেণিতে এই নামে বিষয় ইতিমধ্যে আছে", en: "A subject with this name already exists in this class" }));
      }
      throw err;
    }
  }

  async reorderBooks(classId: number, orderedBookIds: number[]) {
    if (!classId) throw new BadRequestError(t({ bn: "class_id আবশ্যক", en: "class_id is required", ar: "class_id مطلوب" }));
    const rows = await this.repository.findBookIdsByClass(classId);
    const allIds = rows.map((r) => r.id);
    const sameSet = allIds.length === orderedBookIds.length && allIds.every((id) => orderedBookIds.includes(id));
    if (!sameSet) throw new BadRequestError(t({ bn: "book_ids অবশ্যই এই শ্রেণির বিষয়গুলোর সাথে হুবহু মিলতে হবে", en: "book_ids must match this class's subjects exactly" }));

    await this.repository.reorderBooks(classId, orderedBookIds);
  }

  async updateBook(id: number, dto: UpdateBookRequestDto) {
    const nameBn = String(dto.name_bn || "").trim();
    if (!nameBn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn is required", ar: "name_bn مطلوب" }));

    try {
      await this.repository.updateBook(id, nameBn);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "বিষয় পাওয়া যায়নি", en: "Subject not found" }));
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(t({ bn: "এই শ্রেণিতে এই নামে বিষয় ইতিমধ্যে আছে", en: "A subject with this name already exists in this class" }));
      }
      throw err;
    }
  }

  async deleteBook(id: number) {
    try {
      await this.repository.deleteBook(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError(t({ bn: "বিষয় পাওয়া যায়নি", en: "Subject not found" }));
      }
      if (isInUseError(err)) {
        throw new ConflictError(t({ bn: "এই বিষয়টি ব্যবহারে আছে (মার্ক/রেজাল্ট যুক্ত আছে), মুছে ফেলা যাবে না", en: "This subject is in use (marks/results are linked) and cannot be deleted" }));
      }
      throw err;
    }
  }
}

export const metaService = new MetaService();
