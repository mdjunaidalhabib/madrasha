import { reportsRepository, ReportsRepository } from "../reports.repository";

export class AcademicReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getResults(madrasaId: number) {
    return this.repository.findAcademicResults(madrasaId);
  }

  getResultNotice(madrasaId: number) {
    return this.repository.findAcademicResultNotice(madrasaId);
  }

  getRoutines(madrasaId: number) {
    return this.repository.findAcademicRoutines(madrasaId);
  }

  getAdmissions(madrasaId: number) {
    return this.repository.findAcademicAdmissions(madrasaId);
  }

  getGuardianPhones(madrasaId: number) {
    return this.repository.findGuardianPhones(madrasaId);
  }

  getResidentialAttendance(madrasaId: number) {
    return this.repository.findResidentialAttendance(madrasaId);
  }

  getDailyAttendance(madrasaId: number) {
    return this.repository.findDailyAttendance(madrasaId);
  }

  getDigitalAttendance(madrasaId: number) {
    return this.repository.findDigitalAttendance(madrasaId);
  }
}

export const academicReportService = new AcademicReportService();
