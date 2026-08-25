import { AcademicResultFilters, reportsRepository, ReportsRepository } from "../reports.repository";

export class AcademicReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getResults(madrasaId: number, filters: AcademicResultFilters = {}) {
    return this.repository.findAcademicResults(madrasaId, filters);
  }

  getResultsByRank(madrasaId: number, filters: AcademicResultFilters = {}) {
    return this.repository.findAcademicResultsByRank(madrasaId, filters);
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

  getPrizeBookLabels(madrasaId: number, examId?: number, mumtazOnly?: boolean) {
    return this.repository.findPrizeBookLabels(madrasaId, examId, mumtazOnly);
  }

  getExamSignatureSheet(madrasaId: number, examId?: number) {
    return this.repository.findExamSignatureSheet(madrasaId, examId);
  }

  getExamNumberSheet(madrasaId: number, examId?: number) {
    return this.repository.findExamNumberSheet(madrasaId, examId);
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
