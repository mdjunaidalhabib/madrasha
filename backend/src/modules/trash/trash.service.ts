import { NotFoundError } from "../../shared/errors";
import { trashRepository, TrashRepository } from "./trash.repository";
import { toStudentApiDto } from "../students/student.mapper";
import { toTeacherApiDto } from "../teacher/teacher.mapper";
import { linkName, tenantDivisionName, tenantClassName } from "../../shared/utils/tenant-name.util";
import { t } from "../../shared/i18n";

/** How long a soft-deleted record sits in Trash before the background
 * sweep (see core/bootstrap.ts) permanently removes it. */
export const TRASH_RETENTION_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const daysRemaining = (deletedAt: Date | string | null): number => {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsedDays = (Date.now() - new Date(deletedAt).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
};

export class TrashService {
  constructor(private readonly repository: TrashRepository = trashRepository) {}

  /* ================= LIST ================= */

  async listStudents(madrasaId: number) {
    const rows = await this.repository.findTrashedStudents(madrasaId);
    return rows.map((row) => ({
      ...toStudentApiDto(row),
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  async listTeachers(madrasaId: number) {
    const rows = await this.repository.findTrashedTeachers(madrasaId);
    return rows.map((row) => ({
      ...toTeacherApiDto(row),
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  async listExams(madrasaId: number) {
    const rows = await this.repository.findTrashedExams(madrasaId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      year: row.year,
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  async listDivisions(madrasaId: number) {
    const rows = await this.repository.findTrashedDivisions(madrasaId);
    return rows.map((row) => ({
      id: row.id,
      name_bn: linkName(row, row.division),
      name: row.division.name,
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  async listClasses(madrasaId: number) {
    const rows = await this.repository.findTrashedClasses(madrasaId);
    return rows.map((row) => ({
      id: row.id,
      class_name_bn: linkName(row, row.class),
      class_name: row.class.name,
      division_name_bn: tenantDivisionName(row.class.division),
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  async listBooks(madrasaId: number) {
    const rows = await this.repository.findTrashedBooks(madrasaId);
    return rows.map((row) => ({
      id: row.id,
      book_name_bn: row.book.nameBn,
      book_name: row.book.name,
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  async listResults(madrasaId: number) {
    const rows = await this.repository.findTrashedResults(madrasaId);
    return rows.map((row) => ({
      id: row.id,
      exam_name: row.exam.name,
      exam_year: row.exam.year,
      class_name_bn: tenantClassName(row.class),
      class_name: row.class.name,
      status: row.status,
      deleted_at: row.deletedAt,
      days_remaining: daysRemaining(row.deletedAt),
    }));
  }

  /* ================= RESTORE ================= */

  async restoreStudent(id: number, madrasaId: number) {
    const result = await this.repository.restoreStudent(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে শিক্ষার্থী পাওয়া যায়নি", en: "Trashed student not found" }));
  }

  async restoreTeacher(id: number, madrasaId: number) {
    const result = await this.repository.restoreTeacher(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে শিক্ষক পাওয়া যায়নি", en: "Trashed teacher not found" }));
  }

  async restoreExam(id: number, madrasaId: number) {
    const result = await this.repository.restoreExam(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে পরীক্ষা পাওয়া যায়নি", en: "Trashed exam not found" }));
  }

  async restoreDivision(id: number, madrasaId: number) {
    const result = await this.repository.restoreDivision(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে বিভাগ পাওয়া যায়নি", en: "Trashed division not found" }));
  }

  async restoreClass(id: number, madrasaId: number) {
    const result = await this.repository.restoreClass(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে শ্রেণি পাওয়া যায়নি", en: "Trashed class not found" }));
  }

  async restoreBook(id: number, madrasaId: number) {
    const result = await this.repository.restoreBook(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে বিষয় পাওয়া যায়নি", en: "Trashed subject not found" }));
  }

  async restoreResult(id: number, madrasaId: number) {
    const result = await this.repository.restoreResult(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে ফলাফল পাওয়া যায়নি", en: "Trashed result not found" }));
  }

  /* ================= PERMANENT DELETE ================= */

  async permanentDeleteStudent(id: number, madrasaId: number) {
    const result = await this.repository.permanentDeleteStudent(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে শিক্ষার্থী পাওয়া যায়নি", en: "Trashed student not found" }));
  }

  async permanentDeleteTeacher(id: number, madrasaId: number) {
    const result = await this.repository.permanentDeleteTeacher(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে শিক্ষক পাওয়া যায়নি", en: "Trashed teacher not found" }));
  }

  async permanentDeleteExam(id: number, madrasaId: number) {
    const count = await this.repository.permanentDeleteExam(id, madrasaId);
    if (!count) throw new NotFoundError(t({ bn: "ট্র্যাশে পরীক্ষা পাওয়া যায়নি", en: "Trashed exam not found" }));
  }

  async permanentDeleteDivision(id: number, madrasaId: number) {
    const result = await this.repository.permanentDeleteDivision(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে বিভাগ পাওয়া যায়নি", en: "Trashed division not found" }));
  }

  async permanentDeleteClass(id: number, madrasaId: number) {
    const result = await this.repository.permanentDeleteClass(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "ট্র্যাশে শ্রেণি পাওয়া যায়নি", en: "Trashed class not found" }));
  }

  async permanentDeleteBook(id: number, madrasaId: number) {
    const count = await this.repository.permanentDeleteBook(id, madrasaId);
    if (!count) throw new NotFoundError(t({ bn: "ট্র্যাশে বিষয় পাওয়া যায়নি", en: "Trashed subject not found" }));
  }

  async permanentDeleteResult(id: number, madrasaId: number) {
    const count = await this.repository.permanentDeleteResult(id, madrasaId);
    if (!count) throw new NotFoundError(t({ bn: "ট্র্যাশে ফলাফল পাওয়া যায়নি", en: "Trashed result not found" }));
  }

  /* ================= AUTO-PURGE ================= */

  purgeExpired() {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * MS_PER_DAY);
    return this.repository.purgeExpired(cutoff);
  }
}

export const trashService = new TrashService();
