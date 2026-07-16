import { reportsRepository, ReportsRepository } from "../reports.repository";

export class TeacherReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getList(madrasaId: number) {
    return this.repository.findTeacherList(madrasaId);
  }

  getPhones(madrasaId: number) {
    return this.repository.findTeacherPhones(madrasaId);
  }
}

export const teacherReportService = new TeacherReportService();
