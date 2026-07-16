import { BadRequestError } from "../../shared/errors";
import { classPanelRepository, ClassPanelRepository } from "./class-panel.repository";
import { TenantNotFoundInPanelError } from "./class-panel.types";
import {
  AddClassRequestDto,
  AddSubjectRequestDto,
  UpdateClassRequestDto,
  UpdateSubjectRequestDto,
} from "./class-panel.dto";

export class ClassPanelService {
  constructor(private readonly repository: ClassPanelRepository = classPanelRepository) {}

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
    }));
  }

  async addSubject(madrasaId: number | undefined, dto: AddSubjectRequestDto) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    if (!dto.class_id || !dto.name_bn) {
      throw new BadRequestError("class_id and name_bn required");
    }

    const created = await this.repository.createSubject(dto.name_bn, Number(dto.class_id));
    await this.repository.linkSubjectToMadrasa(madrasaId, created.id);
  }

  async updateSubject(id: number, dto: UpdateSubjectRequestDto) {
    if (!dto.name_bn) throw new BadRequestError("name_bn required");
    await this.repository.updateSubject(id, dto.name_bn);
  }

  async deleteSubject(madrasaId: number | undefined, id: number) {
    if (!madrasaId) throw new TenantNotFoundInPanelError();
    await this.repository.deactivateMadrasaSubject(madrasaId, id);
  }
}

export const classPanelService = new ClassPanelService();
