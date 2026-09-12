import {
  AbsentCandidateFilters,
  AcademicResultFilters,
  ExamAttendanceSheetFilters,
  ExamRoutineFilters,
  ExamSummaryFilters,
  InvigilatorListFilters,
  reportsRepository,
  ReportsRepository,
  ResultNoticeFilters,
  ResultPublicationFilters,
  ResultStatusFilters,
  RosterFilters,
  RoutineFilters,
  SeatPlanFilters,
  SubjectPerformanceFilters,
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

  getExamRoutine(madrasaId: number, examId?: number, filters: ExamRoutineFilters = {}) {
    return this.repository.findExamRoutineList(madrasaId, examId, filters, false);
  }

  getExamRoutineByRoom(madrasaId: number, examId?: number, filters: ExamRoutineFilters = {}) {
    return this.repository.findExamRoutineList(madrasaId, examId, filters, true);
  }

  getSeatPlan(madrasaId: number, examId?: number, filters: SeatPlanFilters = {}) {
    return this.repository.findSeatPlan(madrasaId, examId, filters);
  }

  getInvigilatorList(madrasaId: number, examId?: number, filters: InvigilatorListFilters = {}) {
    return this.repository.findInvigilatorList(madrasaId, examId, filters);
  }

  getExamAttendanceSheet(madrasaId: number, examId?: number, filters: ExamAttendanceSheetFilters = {}) {
    return this.repository.findExamAttendanceSheet(madrasaId, examId, filters);
  }

  getExamCandidates(madrasaId: number, examId?: number, filters: RosterFilters = {}) {
    return this.repository.findExamCandidateList(madrasaId, examId, filters);
  }

  getAbsentCandidates(madrasaId: number, examId?: number, filters: AbsentCandidateFilters = {}) {
    return this.repository.findAbsentCandidates(madrasaId, examId, filters);
  }

  getResultsByStatus(madrasaId: number, status: "PASS" | "FAIL", filters: ResultStatusFilters = {}) {
    return this.repository.findResultsByStatus(madrasaId, status, filters);
  }

  getSubjectPerformance(madrasaId: number, filters: SubjectPerformanceFilters = {}) {
    return this.repository.findSubjectPerformance(madrasaId, filters);
  }

  getExamSummary(madrasaId: number, filters: ExamSummaryFilters = {}) {
    return this.repository.findExamSummary(madrasaId, filters);
  }

  getResultPublicationStatus(madrasaId: number, filters: ResultPublicationFilters = {}) {
    return this.repository.findResultPublicationStatus(madrasaId, filters);
  }
}

export const academicReportService = new AcademicReportService();
