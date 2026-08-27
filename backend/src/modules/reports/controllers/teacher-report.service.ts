import { reportsRepository, ReportsRepository } from "../reports.repository";

export class TeacherReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getList(madrasaId: number, divisionId?: number) {
    return this.repository.findTeacherList(madrasaId, divisionId);
  }

  getPhones(madrasaId: number, divisionId?: number) {
    return this.repository.findTeacherPhones(madrasaId, divisionId);
  }
}

export const teacherReportService = new TeacherReportService();
