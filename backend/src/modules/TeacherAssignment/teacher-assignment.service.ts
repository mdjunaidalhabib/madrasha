import {
  teacherAssignmentRepository,
  TeacherAssignmentRepository,
} from "./teacher-assignment.repository";
import { AssignmentAlreadyExistsError, GroupedAssignment } from "./teacher-assignment.types";

export class TeacherAssignmentService {
  constructor(
    private readonly repository: TeacherAssignmentRepository = teacherAssignmentRepository,
  ) {}

  async getBookIds(madrasaId: number, teacherId: number, classId: number): Promise<number[]> {
    const rows = await this.repository.findBookIds(madrasaId, teacherId, classId);
    return rows.map((r) => Number(r.bookId));
  }

  async getAllGrouped(madrasaId: number): Promise<GroupedAssignment[]> {
    const rows = await this.repository.findAllForTenant(madrasaId);

    const grouped: Record<string, GroupedAssignment> = {};

    rows.forEach((row) => {
      const key = `${row.teacher.id}-${row.classId}`;

      if (!grouped[key]) {
        grouped[key] = {
          teacher_id: row.teacher.id,
          teacher_name: row.teacher.nameBn,
          class_id: row.classId,
          books: [],
        };
      }

      grouped[key].books.push({
        book_id: row.bookId,
        book_name_bn: row.book.nameBn,
      });
    });

    return Object.values(grouped);
  }

  async saveAssignment(madrasaId: number, teacherId: number, classId: number, bookIds: number[]) {
    // Teacher already assigned (within this madrasa)? block new create
    const existingCount = await this.repository.countForTeacher(madrasaId, teacherId);
    if (existingCount > 0) {
      throw new AssignmentAlreadyExistsError();
    }

    if (bookIds.length > 0) {
      await this.repository.createMany(madrasaId, teacherId, classId, bookIds);
    }
  }

  async updateAssignment(madrasaId: number, teacherId: number, classId: number, bookIds: number[]) {
    await this.repository.deleteMany(madrasaId, teacherId, classId);

    if (bookIds.length > 0) {
      await this.repository.createMany(madrasaId, teacherId, classId, bookIds);
    }
  }

  async deleteAssignment(madrasaId: number, teacherId: number, classId: number) {
    await this.repository.deleteMany(madrasaId, teacherId, classId);
  }
}

export const teacherAssignmentService = new TeacherAssignmentService();
