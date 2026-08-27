import { reportsRepository, ReportsRepository, RosterFilters } from "../reports.repository";

export class StudentReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getIdCards(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findStudentIdCards(madrasaId, filters);
  }

  getMarksheets(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findStudentMarksheets(madrasaId, filters);
  }

  getCertificates(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findStudentCertificates(madrasaId, filters);
  }

  getAdmitCards(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findStudentAdmitCards(madrasaId, filters);
  }

  getSanads(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findStudentSanads(madrasaId, filters);
  }

  getTransferLetters(madrasaId: number, filters: RosterFilters = {}) {
    return this.repository.findStudentTransferLetters(madrasaId, filters);
  }
}

export const studentReportService = new StudentReportService();
