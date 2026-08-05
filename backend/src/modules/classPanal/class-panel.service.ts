import { BadRequestError, NotFoundError } from "../../shared/errors";
import { resultPanelService, ResultPanelService } from "../ResultPanel/result-panel.service";
import { classPanelRepository, ClassPanelRepository } from "./class-panel.repository";
import { TenantNotFoundInPanelError } from "./class-panel.types";
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
} from "./class-panel.dto";

export class ClassPanelService {
  constructor(
    private readonly repository: ClassPanelRepository = classPanelRepository,
    private readonly results: ResultPanelService = resultPanelService,
  ) {}

  async listDivisions(madrasaId: number | undefined) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const rows = await this.repository.findActiveDivisions(madrasaId);
    return rows.map((r) => ({ division_id: r.division.id, division_name_bn: r.division.nameBn }));
  }

  async listClasses(madrasaId: number | undefined, divisionId: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!divisionId) throw new BadRequestError("division_id is required");

    const rows = await this.repository.findActiveClassesByDivision(madrasaId, divisionId);
    return rows.map((r) => ({
      class_id: r.class.id,
      class_name_bn: r.class.nameBn,
      division_id: r.class.divisionId,
    }));
  }

  async addClass(madrasaId: number | undefined, dto: AddClassRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.division_id || !dto.name_bn) {
      throw new BadRequestError("division_id and name_bn required");
    }

    const created = await this.repository.createClass(dto.name_bn, Number(dto.division_id));
    await this.repository.linkClassToMadrasa(madrasaId, created.id, Number(dto.division_id));
  }

  async updateClass(id: number, dto: UpdateClassRequestDto) {
    if (!dto.name_bn) throw new BadRequestError("name_bn required");
    await this.repository.updateClass(id, dto.name_bn);
  }

  async deleteClass(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    await this.repository.deactivateMadrasaClass(madrasaId, id);
  }

  async deleteDivision(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    await this.repository.deactivateMadrasaDivision(madrasaId, id);
  }

  async updateDivision(id: number, dto: UpdateDivisionRequestDto) {
    if (!dto.name_bn) throw new BadRequestError("name_bn required");
    await this.repository.updateDivision(id, dto.name_bn);
  }

  async reorderDivisions(madrasaId: number | undefined, dto: ReorderDivisionsRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const orderedDivisionIds = (Array.isArray(dto.division_ids) ? dto.division_ids : []).map(Number);
    if (orderedDivisionIds.some((id) => !id)) {
      throw new BadRequestError("division_ids must be valid ids");
    }

    const rows = await this.repository.findActiveDivisions(madrasaId);
    const activeDivisionIds = rows.map((row) => row.division.id);

    const sameSet =
      activeDivisionIds.length === orderedDivisionIds.length &&
      activeDivisionIds.every((id) => orderedDivisionIds.includes(id));
    if (!sameSet) {
      throw new BadRequestError("division_ids must match this madrasa's active divisions exactly");
    }

    await this.repository.reorderDivisions(madrasaId, orderedDivisionIds);

    return { message: "বিভাগের ক্রম সংরক্ষণ করা হয়েছে" };
  }

  async reorderClasses(madrasaId: number | undefined, dto: ReorderClassesRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const divisionId = Number(dto.division_id);
    if (!divisionId) throw new BadRequestError("division_id is required");

    const orderedClassIds = (Array.isArray(dto.class_ids) ? dto.class_ids : []).map(Number);
    if (orderedClassIds.some((id) => !id)) {
      throw new BadRequestError("class_ids must be valid ids");
    }

    const rows = await this.repository.findActiveClassesByDivision(madrasaId, divisionId);
    const activeClassIds = rows.map((row) => row.class.id);

    const sameSet =
      activeClassIds.length === orderedClassIds.length &&
      activeClassIds.every((id) => orderedClassIds.includes(id));
    if (!sameSet) {
      throw new BadRequestError("class_ids must match this division's active classes exactly");
    }

    await this.repository.reorderClasses(madrasaId, orderedClassIds);

    return { message: "শ্রেণির ক্রম সংরক্ষণ করা হয়েছে" };
  }

  async listSubjects(madrasaId: number | undefined, classId: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!classId) throw new BadRequestError("class_id is required");

    const rows = await this.repository.findActiveSubjectsByClass(madrasaId, classId);
    return rows.map((r) => ({
      book_id: r.book.id,
      book_name_bn: r.book.nameBn,
      class_id: r.book.classId,
      is_miyari: r.isMiyari,
      full_marks: r.fullMark,
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

    if (!classId) throw new BadRequestError("class_id is required");

    const subjects = await this.repository.findActiveSubjectsByClass(madrasaId, classId);
    const activeBookIds = new Set(subjects.map((row) => row.book.id));
    if (bookIds.some((bookId) => !activeBookIds.has(bookId))) {
      throw new BadRequestError("নির্বাচিত কিতাবটি এই শ্রেণির সক্রিয় কিতাব নয়");
    }

    await this.repository.setMiyariSubjects(madrasaId, classId, bookIds);
    const resultRefresh = await this.results.reprocessClassResults(madrasaId, classId);

    return {
      message: "মিয়ারি কিতাব সংরক্ষণ করা হয়েছে",
      book_ids: bookIds,
      refreshed_results: resultRefresh.updated,
      skipped_incomplete_results: resultRefresh.skipped,
    };
  }

  async reorderSubjects(madrasaId: number | undefined, dto: ReorderSubjectsRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const classId = Number(dto.class_id);
    if (!classId) throw new BadRequestError("class_id is required");

    const orderedBookIds = (Array.isArray(dto.book_ids) ? dto.book_ids : []).map(Number);
    if (orderedBookIds.some((id) => !id)) {
      throw new BadRequestError("book_ids must be valid ids");
    }

    const subjects = await this.repository.findActiveSubjectsByClass(madrasaId, classId);
    const activeBookIds = subjects.map((row) => row.book.id);

    const sameSet =
      activeBookIds.length === orderedBookIds.length &&
      activeBookIds.every((id) => orderedBookIds.includes(id));
    if (!sameSet) {
      throw new BadRequestError("book_ids must match this class's active books exactly");
    }

    await this.repository.reorderSubjects(madrasaId, orderedBookIds);

    return { message: "কিতাবের ক্রম সংরক্ষণ করা হয়েছে" };
  }

  async addSubject(madrasaId: number | undefined, dto: AddSubjectRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.class_id || !dto.name_bn) {
      throw new BadRequestError("class_id and name_bn required");
    }

    const classId = Number(dto.class_id);
    const linkedClass = await this.repository.findActiveClassForMadrasa(madrasaId, classId);
    if (!linkedClass) throw new NotFoundError("Class not found in this madrasa");

    await this.repository.createAndLinkSubject(madrasaId, dto.name_bn, classId);
    await this.results.reprocessClassResults(madrasaId, classId);
  }

  async updateSubject(madrasaId: number | undefined, id: number, dto: UpdateSubjectRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.name_bn) throw new BadRequestError("name_bn required");

    const linkedSubject = await this.repository.findSubjectForMadrasa(madrasaId, id);
    if (!linkedSubject?.book) throw new NotFoundError("Subject not found");

    const updated = await this.repository.updateSubjectForMadrasa(madrasaId, id, dto.name_bn);
    if (!updated) throw new NotFoundError("Subject not found");

    if (dto.full_marks !== undefined) {
      const fullMark = Number(dto.full_marks);
      if (!Number.isFinite(fullMark) || fullMark <= 0) {
        throw new BadRequestError("full_marks must be a positive number");
      }

      // `updated.id` — not the route's `id` — because a shared seeded
      // subject may have just been copy-on-write'd to a new private Book
      // (see updateSubjectForMadrasa), which repoints this madrasa's
      // madrasa_books row at that new book id.
      await this.repository.updateSubjectFullMark(madrasaId, updated.id, Math.round(fullMark));
      await this.results.reprocessClassResults(madrasaId, linkedSubject.book.classId);
    }
  }

  async getSubjectDeleteInfo(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const linkedSubject = await this.repository.findSubjectForMadrasa(madrasaId, id);
    if (!linkedSubject?.book) throw new NotFoundError("Subject not found");

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
    if (!linkedSubject?.book) throw new NotFoundError("Subject not found");

    // Marks are preserved — this only moves the subject to Trash.
    await this.repository.deactivateSubject(madrasaId, id);
    await this.results.reprocessClassResults(madrasaId, linkedSubject.book.classId);
  }
}

export const classPanelService = new ClassPanelService();
