import { NotFoundError } from "../../shared/errors";
import { trashRepository, TrashRepository } from "./trash.repository";
import { toStudentApiDto } from "../students/student.mapper";
import { toTeacherApiDto } from "../teacher/teacher.mapper";

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

  /* ================= RESTORE ================= */

  async restoreStudent(id: number, madrasaId: number) {
    const result = await this.repository.restoreStudent(id, madrasaId);
    if (!result.count) throw new NotFoundError("Trashed student not found");
  }

  async restoreTeacher(id: number, madrasaId: number) {
    const result = await this.repository.restoreTeacher(id, madrasaId);
    if (!result.count) throw new NotFoundError("Trashed teacher not found");
  }

  async restoreExam(id: number, madrasaId: number) {
    const result = await this.repository.restoreExam(id, madrasaId);
    if (!result.count) throw new NotFoundError("Trashed exam not found");
  }

  /* ================= PERMANENT DELETE ================= */

  async permanentDeleteStudent(id: number, madrasaId: number) {
    const result = await this.repository.permanentDeleteStudent(id, madrasaId);
    if (!result.count) throw new NotFoundError("Trashed student not found");
  }

  async permanentDeleteTeacher(id: number, madrasaId: number) {
    const result = await this.repository.permanentDeleteTeacher(id, madrasaId);
    if (!result.count) throw new NotFoundError("Trashed teacher not found");
  }

  async permanentDeleteExam(id: number, madrasaId: number) {
    const count = await this.repository.permanentDeleteExam(id, madrasaId);
    if (!count) throw new NotFoundError("Trashed exam not found");
  }

  /* ================= AUTO-PURGE ================= */

  purgeExpired() {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * MS_PER_DAY);
    return this.repository.purgeExpired(cutoff);
  }
}

export const trashService = new TrashService();
