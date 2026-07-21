import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { resultPanelService, ResultPanelService } from "../ResultPanel/result-panel.service";
import { classPanelRepository, ClassPanelRepository } from "./class-panel.repository";
import { TenantNotFoundInPanelError } from "./class-panel.types";
import {
  AddClassRequestDto,
  AddSubjectRequestDto,
  UpdateClassRequestDto,
  UpdateSubjectRequestDto,
  UpdateMiyariSubjectsRequestDto,
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
    await this.repository.linkClassToMadrasa(madrasaId, created.id);
  }

  async updateClass(id: number, dto: UpdateClassRequestDto) {
    if (!dto.name_bn) throw new BadRequestError("name_bn required");
    await this.repository.updateClass(id, dto.name_bn);
  }

  async deleteClass(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    await this.repository.deactivateMadrasaClass(madrasaId, id);
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
    if (bookIds.length < 1) {
      throw new BadRequestError("অন্তত ১টি মিয়ারি কিতাব নির্বাচন করুন");
    }

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

  async deleteSubject(madrasaId: number | undefined, id: number, confirmMarkDeletion = false) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();

    const linkedSubject = await this.repository.findSubjectForMadrasa(madrasaId, id);
    if (!linkedSubject?.book) throw new NotFoundError("Subject not found");

    const markCount = await this.repository.countSubjectMarks(madrasaId, id);
    if (markCount > 0 && !confirmMarkDeletion) {
      throw new ConflictError(
        "This subject has saved marks. Confirm mark deletion before deleting the subject.",
        { requires_confirmation: true, mark_count: markCount },
      );
    }

    await this.repository.deactivateSubjectAndRemoveMarks(madrasaId, id);
    await this.results.reprocessClassResults(madrasaId, linkedSubject.book.classId);
  }
}

export const classPanelService = new ClassPanelService();
