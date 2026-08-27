import {
  AcademicResultFilters,
  reportsRepository,
  ReportsRepository,
  ResultNoticeFilters,
  RosterFilters,
  RoutineFilters,
} from "../reports.repository";

export class AcademicReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getResults(madrasaId: number, filters: AcademicResultFilters = {}) {
    return this.repository.findAcademicResults(madrasaId, filters);
  }

  getResultsByRank(madrasaId: number, filters: AcademicResultFilters = {}) {
    return this.repository.findAcademicResultsByRank(madrasaId, filters);
  }

  getResultNotice(madrasaId: number, filters: ResultNoticeFilters = {}) {
    return this.repository.findAcademicResultNotice(madrasaId, filters);
  }

  getRoutines(madrasaId: number, filters: RoutineFilters = {}) {
    return this.repository.findAcademicRoutines(madrasaId, filters);
  }

  getAdmissions(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findAcademicAdmissions(madrasaId, filters);
  }

  getGuardianPhones(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findGuardianPhones(madrasaId, filters);
  }

  getPrizeBookLabels(madrasaId: number, examId?: number, mumtazOnly?: boolean, filters: RosterFilters = {}) {
    return this.repository.findPrizeBookLabels(madrasaId, examId, mumtazOnly, filters);
  }

  getExamSignatureSheet(madrasaId: number, examId?: number, filters: RosterFilters = {}) {
    return this.repository.findExamSignatureSheet(madrasaId, examId, filters);
  }

  getExamNumberSheet(madrasaId: number, examId?: number, filters: RosterFilters = {}) {
    return this.repository.findExamNumberSheet(madrasaId, examId, filters);
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
