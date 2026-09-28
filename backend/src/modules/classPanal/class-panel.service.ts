import { BadRequestError, NotFoundError } from "../../shared/errors";
import { resultPanelService, ResultPanelService } from "../ResultPanel/result-panel.service";
import { classPanelRepository, ClassPanelRepository } from "./class-panel.repository";
import { TenantNotFoundInPanelError } from "./class-panel.types";
import { examFeeService } from "../fee/exam-fee.service";
import { logger } from "../../shared/logger/logger";
import { linkName } from "../../shared/utils/tenant-name.util";
import { withTransaction } from "../../shared/database/transaction";
import { assignMissingRegistrationBlocksOnTx } from "../students/registration-block.provisioner";
import {
  AddClassRequestDto,
  AddSubjectRequestDto,
  UpdateClassRequestDto,
  UpdateSubjectRequestDto,
  UpdateMiyariSubjectsRequestDto,
  ReorderSubjectsRequestDto,
  ReorderClassesRequestDto,
  UpdateDivisionRequestDto,
  ReorderDivisionsRequestDto,
  UpdateClassRegistrationBlockRequestDto,
} from "./class-panel.dto";
import { t } from "../../shared/i18n";

export class ClassPanelService {
  constructor(
    private readonly repository: ClassPanelRepository = classPanelRepository,
    private readonly results: ResultPanelService = resultPanelService,
  ) {}

  async listDivisions(madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const rows = await this.repository.findActiveDivisions(madrasaId);
    return rows.map((r) => ({ division_id: r.division.id, division_name_bn: linkName(r, r.division) }));
  }

  async listClasses(madrasaId: number | undefined, divisionId: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!divisionId) throw new BadRequestError(t({ bn: "division_id আবশ্যক", en: "division_id is required" }));

    const rows = await this.repository.findActiveClassesByDivision(madrasaId, divisionId);
    return rows.map((r) => ({
      class_id: r.class.id,
      class_name_bn: linkName(r, r.class),
      division_id: r.class.divisionId,
    }));
  }

  async addClass(madrasaId: number | undefined, dto: AddClassRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.division_id || !dto.name_bn) {
      throw new BadRequestError(t({ bn: "division_id ও name_bn আবশ্যক", en: "division_id and name_bn required" }));
    }

    const created = await this.repository.createClass(madrasaId, dto.name_bn, Number(dto.division_id));
    await this.repository.linkClassToMadrasa(madrasaId, created.id, Number(dto.division_id));

    // Give the new class its registration-number block from the plan's
    // size for this বিভাগ, after every existing block. Never fails the class
    // creation itself - the admin can still set a block by hand.
    try {
      await withTransaction((tx) => assignMissingRegistrationBlocksOnTx(tx, madrasaId));
    } catch (err) {
      logger.error("addClass registration block assign failed:", err);
    }

    // The new class joins every exam held for its বিভাগ - give it its
    // পরীক্ষার ফি rows too. Never fails the class creation itself.
    try {
      await examFeeService.syncAllExams(madrasaId);
    } catch (err) {
      logger.error("addClass exam fee sync failed:", err);
    }
  }

  async updateClass(madrasaId: number | undefined, id: number, dto: UpdateClassRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.name_bn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn required" }));
    const { count } = await this.repository.updateClassName(madrasaId, id, dto.name_bn);
    if (!count) throw new NotFoundError(t({ bn: "এই প্রতিষ্ঠানে শ্রেণিটি পাওয়া যায়নি", en: "Class not found in this institution" }));
  }

  async deleteClass(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    await this.repository.deactivateMadrasaClass(madrasaId, id);
  }

  async deleteDivision(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    await this.repository.deactivateMadrasaDivision(madrasaId, id);
  }

  async updateDivision(madrasaId: number | undefined, id: number, dto: UpdateDivisionRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.name_bn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn required" }));
    const { count } = await this.repository.updateDivisionName(madrasaId, id, dto.name_bn);
    if (!count) throw new NotFoundError(t({ bn: "এই প্রতিষ্ঠানে বিভাগটি পাওয়া যায়নি", en: "Division not found in this institution" }));
  }

  async reorderDivisions(madrasaId: number | undefined, dto: ReorderDivisionsRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const orderedDivisionIds = (Array.isArray(dto.division_ids) ? dto.division_ids : []).map(Number);
    if (orderedDivisionIds.some((id) => !id)) {
      throw new BadRequestError(t({ bn: "division_ids সঠিক আইডি হতে হবে", en: "division_ids must be valid ids" }));
    }

    const rows = await this.repository.findActiveDivisions(madrasaId);
    const activeDivisionIds = rows.map((row) => row.division.id);

    const sameSet =
      activeDivisionIds.length === orderedDivisionIds.length &&
      activeDivisionIds.every((id) => orderedDivisionIds.includes(id));
    if (!sameSet) {
      throw new BadRequestError(t({ bn: "division_ids অবশ্যই এই প্রতিষ্ঠানের সক্রিয় বিভাগগুলোর সাথে হুবহু মিলতে হবে", en: "division_ids must match this institution's active divisions exactly" }));
    }

    await this.repository.reorderDivisions(madrasaId, orderedDivisionIds);

    return { message: t({ bn: "বিভাগের ক্রম সংরক্ষণ করা হয়েছে", en: "Division order saved" }) };
  }

  async reorderClasses(madrasaId: number | undefined, dto: ReorderClassesRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const divisionId = Number(dto.division_id);
    if (!divisionId) throw new BadRequestError(t({ bn: "division_id আবশ্যক", en: "division_id is required" }));

    const orderedClassIds = (Array.isArray(dto.class_ids) ? dto.class_ids : []).map(Number);
    if (orderedClassIds.some((id) => !id)) {
      throw new BadRequestError(t({ bn: "class_ids সঠিক আইডি হতে হবে", en: "class_ids must be valid ids" }));
    }

    const rows = await this.repository.findActiveClassesByDivision(madrasaId, divisionId);
    const activeClassIds = rows.map((row) => row.class.id);

    const sameSet =
      activeClassIds.length === orderedClassIds.length &&
      activeClassIds.every((id) => orderedClassIds.includes(id));
    if (!sameSet) {
      throw new BadRequestError(t({ bn: "class_ids অবশ্যই এই বিভাগের সক্রিয় শ্রেণিগুলোর সাথে হুবহু মিলতে হবে", en: "class_ids must match this division's active classes exactly" }));
    }

    await this.repository.reorderClasses(madrasaId, orderedClassIds);

    return { message: t({ bn: "শ্রেণির ক্রম সংরক্ষণ করা হয়েছে", en: "Class order saved" }) };
  }

  /** Every active class's registration-number block, grouped by বিভাগ in
   * this madrasa's own order, with how much of each block is used. */
  async listRegistrationBlocks(madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const [divisions, blocks] = await Promise.all([
      this.repository.findActiveDivisions(madrasaId),
      this.repository.findActiveClassRegistrationBlocks(madrasaId),
    ]);

    const classes = await Promise.all(
      blocks.map(async (row) => {
        const start = row.regNoStart;
        const end = row.regNoEnd;
        let usedCount = 0;
        let nextRegNo: number | null = null;
        if (start != null && end != null) {
          const usage = await this.repository.getRegistrationUsageInRange(madrasaId, start, end);
          usedCount = usage._count.registrationNo;
          // Same rule as allocateStudentRegistrationNoOnTx.
          const lastIssued =
            row.regNoLastIssued != null && row.regNoLastIssued >= start && row.regNoLastIssued <= end
              ? row.regNoLastIssued
              : start - 1;
          const next = Math.max(start - 1, lastIssued, usage._max.registrationNo ?? 0) + 1;
          nextRegNo = next > end ? null : next;
        }
        return {
          class_id: row.classId,
          class_name_bn: linkName(row, row.class),
          division_id: row.class.divisionId,
          reg_no_start: start,
          reg_no_end: end,
          used_count: usedCount,
          next_reg_no: nextRegNo,
        };
      }),
    );

    return divisions.map((d) => ({
      division_id: d.division.id,
      division_name_bn: linkName(d, d.division),
      classes: classes.filter((c) => c.division_id === d.division.id),
    }));
  }

  async updateRegistrationBlock(
    madrasaId: number | undefined,
    classId: number,
    dto: UpdateClassRegistrationBlockRequestDto,
  ) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!classId) throw new BadRequestError(t({ bn: "class_id আবশ্যক", en: "class_id is required" }));

    const parse = (value: unknown) =>
      value === null || value === undefined || String(value).trim() === "" ? null : Number(value);
    const start = parse(dto.reg_no_start);
    const end = parse(dto.reg_no_end);

    if ((start === null) !== (end === null)) {
      throw new BadRequestError(t({ bn: "শুরু ও শেষ দুটো নম্বরই দিন, অথবা ব্লক মুছতে দুটোই খালি রাখুন", en: "Enter both the start and end numbers, or leave both empty to remove the block" }));
    }
    if (start !== null && end !== null) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 999_999_999) {
        throw new BadRequestError(t({ bn: "রেজি. নম্বর ১ বা তার বেশি পূর্ণসংখ্যা হতে হবে", en: "Registration numbers must be whole numbers of 1 or more" }));
      }
      if (start > end) {
        throw new BadRequestError(t({ bn: "শুরুর নম্বর শেষের নম্বরের চেয়ে বড় হতে পারবে না", en: "The start number cannot be greater than the end number" }));
      }
      const overlap = await this.repository.findOverlappingRegistrationBlock(madrasaId, classId, start, end);
      if (overlap) {
        throw new BadRequestError(
          t({ bn: `এই ব্লকটি "${linkName(overlap, overlap.class)}" শ্রেণির ব্লকের (${overlap.regNoStart}–${overlap.regNoEnd}) সাথে মিলে যাচ্ছে`, en: `This block overlaps the block of class "${linkName(overlap, overlap.class)}" (${overlap.regNoStart}–${overlap.regNoEnd})` }),
        );
      }
    }

    const linkedClass = await this.repository.findActiveClassForMadrasa(madrasaId, classId);
    if (!linkedClass) throw new NotFoundError(t({ bn: "এই প্রতিষ্ঠানে শ্রেণিটি পাওয়া যায়নি", en: "Class not found in this institution" }));

    await this.repository.updateClassRegistrationBlock(madrasaId, classId, start, end);
    return { message: start === null ? "রেজি. নম্বরের ব্লক মুছে ফেলা হয়েছে" : "রেজি. নম্বরের ব্লক সংরক্ষণ করা হয়েছে" };
  }

  async listSubjects(madrasaId: number | undefined, classId: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!classId) throw new BadRequestError(t({ bn: "class_id আবশ্যক", en: "class_id is required" }));

    const rows = await this.repository.findActiveSubjectsByClass(madrasaId, classId);
    return rows.map((r) => ({
      book_id: r.book.id,
      book_name_bn: r.book.nameBn,
      class_id: r.book.classId,
      is_miyari: r.isMiyari,
      full_marks: r.fullMark,
      // null = no override; this subject follows the madrasa's global fail mark.
      pass_mark: r.passMark,
    }));
  }

  async updateMiyariSubjects(
    madrasaId: number | undefined,
    dto: UpdateMiyariSubjectsRequestDto,
  ) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const classId = Number(dto.class_id);
    const bookIds = Array.from(
      new Set((Array.isArray(dto.book_ids) ? dto.book_ids : []).map(Number).filter(Boolean)),
    );

    if (!classId) throw new BadRequestError(t({ bn: "class_id আবশ্যক", en: "class_id is required" }));

    const subjects = await this.repository.findActiveSubjectsByClass(madrasaId, classId);
    const activeBookIds = new Set(subjects.map((row) => row.book.id));
    if (bookIds.some((bookId) => !activeBookIds.has(bookId))) {
      throw new BadRequestError(t({ bn: "নির্বাচিত বিষয়টি এই শ্রেণির সক্রিয় বিষয় নয়", en: "The selected subject is not an active subject of this class" }));
    }

    await this.repository.setMiyariSubjects(madrasaId, classId, bookIds);
    const resultRefresh = await this.results.reprocessClassResults(madrasaId, classId);

    return {
      message: t({ bn: "মিয়ারি বিষয় সংরক্ষণ করা হয়েছে", en: "Standard (mi'yari) subject saved" }),
      book_ids: bookIds,
      refreshed_results: resultRefresh.updated,
      skipped_incomplete_results: resultRefresh.skipped,
    };
  }

  async reorderSubjects(madrasaId: number | undefined, dto: ReorderSubjectsRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const classId = Number(dto.class_id);
    if (!classId) throw new BadRequestError(t({ bn: "class_id আবশ্যক", en: "class_id is required" }));

    const orderedBookIds = (Array.isArray(dto.book_ids) ? dto.book_ids : []).map(Number);
    if (orderedBookIds.some((id) => !id)) {
      throw new BadRequestError(t({ bn: "book_ids সঠিক আইডি হতে হবে", en: "book_ids must be valid ids" }));
    }

    const subjects = await this.repository.findActiveSubjectsByClass(madrasaId, classId);
    const activeBookIds = subjects.map((row) => row.book.id);

    const sameSet =
      activeBookIds.length === orderedBookIds.length &&
      activeBookIds.every((id) => orderedBookIds.includes(id));
    if (!sameSet) {
      throw new BadRequestError(t({ bn: "book_ids অবশ্যই এই শ্রেণির সক্রিয় বিষয়গুলোর সাথে হুবহু মিলতে হবে", en: "book_ids must match this class's active subjects exactly" }));
    }

    await this.repository.reorderSubjects(madrasaId, orderedBookIds);

    return { message: t({ bn: "বিষয়ের ক্রম সংরক্ষণ করা হয়েছে", en: "Subject order saved" }) };
  }

  async addSubject(madrasaId: number | undefined, dto: AddSubjectRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.class_id || !dto.name_bn) {
      throw new BadRequestError(t({ bn: "class_id ও name_bn আবশ্যক", en: "class_id and name_bn required" }));
    }

    const classId = Number(dto.class_id);
    const linkedClass = await this.repository.findActiveClassForMadrasa(madrasaId, classId);
    if (!linkedClass) throw new NotFoundError(t({ bn: "এই প্রতিষ্ঠানে শ্রেণিটি পাওয়া যায়নি", en: "Class not found in this institution" }));

    await this.repository.createAndLinkSubject(madrasaId, dto.name_bn, classId);
    await this.results.reprocessClassResults(madrasaId, classId);
  }

  async updateSubject(madrasaId: number | undefined, id: number, dto: UpdateSubjectRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.name_bn) throw new BadRequestError(t({ bn: "name_bn আবশ্যক", en: "name_bn required" }));

    const linkedSubject = await this.repository.findSubjectForMadrasa(madrasaId, id);
    if (!linkedSubject?.book) throw new NotFoundError(t({ bn: "বিষয় পাওয়া যায়নি", en: "Subject not found" }));

    const updated = await this.repository.updateSubjectForMadrasa(madrasaId, id, dto.name_bn);
    if (!updated) throw new NotFoundError(t({ bn: "বিষয় পাওয়া যায়নি", en: "Subject not found" }));

    // `updated.id` — not the route's `id` — because a shared seeded subject
    // may have just been copy-on-write'd to a new private Book (see
    // updateSubjectForMadrasa), which repoints this madrasa's madrasa_books
    // row at that new book id. Both full_marks and pass_mark must target it.
    let effectiveFullMark = linkedSubject.fullMark;
    let resultsNeedRefresh = false;

    if (dto.full_marks !== undefined) {
      const fullMark = Number(dto.full_marks);
      if (!Number.isFinite(fullMark) || fullMark <= 0) {
        throw new BadRequestError(t({ bn: "full_marks অবশ্যই ধনাত্মক সংখ্যা হতে হবে", en: "full_marks must be a positive number" }));
      }
      effectiveFullMark = Math.round(fullMark);

      await this.repository.updateSubjectFullMark(madrasaId, updated.id, effectiveFullMark);
      resultsNeedRefresh = true;
    }

    if (dto.pass_mark !== undefined) {
      const passMarkRaw = typeof dto.pass_mark === "string" ? dto.pass_mark.trim() : dto.pass_mark;

      if (passMarkRaw === null || passMarkRaw === "") {
        // Clear the override — this subject falls back to the madrasa's
        // global fail mark setting again.
        await this.repository.updateSubjectPassMark(madrasaId, updated.id, null);
      } else {
        const passMark = Number(passMarkRaw);
        if (!Number.isFinite(passMark) || passMark < 0 || passMark > effectiveFullMark) {
          throw new BadRequestError(t({ bn: "pass_mark অবশ্যই 0 থেকে বিষয়ের পূর্ণ নম্বরের মধ্যে হতে হবে", en: "pass_mark must be between 0 and the subject's full marks" }));
        }
        await this.repository.updateSubjectPassMark(madrasaId, updated.id, Math.round(passMark));
      }
      resultsNeedRefresh = true;
    }

    if (resultsNeedRefresh) {
      await this.results.reprocessClassResults(madrasaId, linkedSubject.book.classId);
    }
  }

  async getSubjectDeleteInfo(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const linkedSubject = await this.repository.findSubjectForMadrasa(madrasaId, id);
    if (!linkedSubject?.book) throw new NotFoundError(t({ bn: "বিষয় পাওয়া যায়নি", en: "Subject not found" }));

    const markCount = await this.repository.countSubjectMarks(madrasaId, id);

    return {
      book_id: linkedSubject.book.id,
      book_name_bn: linkedSubject.book.nameBn,
      has_marks: markCount > 0,
      mark_count: markCount,
    };
  }

  async deleteSubject(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const linkedSubject = await this.repository.findSubjectForMadrasa(madrasaId, id);
    if (!linkedSubject?.book) throw new NotFoundError(t({ bn: "বিষয় পাওয়া যায়নি", en: "Subject not found" }));

    // Marks are preserved — this only moves the subject to Trash.
    await this.repository.deactivateSubject(madrasaId, id);
    await this.results.reprocessClassResults(madrasaId, linkedSubject.book.classId);
  }
}

export const classPanelService = new ClassPanelService();
