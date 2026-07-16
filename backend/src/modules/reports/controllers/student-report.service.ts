import { reportsRepository, ReportsRepository } from "../reports.repository";

export class StudentReportService {
  constructor(private readonly repository: ReportsRepository = reportsRepository) {}

  getIdCards(madrasaId: number) {
    return this.repository.findStudentIdCards(madrasaId);
  }

  getMarksheets(madrasaId: number) {
    return this.repository.findStudentMarksheets(madrasaId);
  }

  getCertificates(madrasaId: number) {
    return this.repository.findStudentCertificates(madrasaId);
  }

  getAdmitCards(madrasaId: number) {
    return this.repository.findStudentAdmitCards(madrasaId);
  }

  getSanads(madrasaId: number) {
    return this.repository.findStudentSanads(madrasaId);
  }

  getTransferLetters(madrasaId: number) {
    return this.repository.findStudentTransferLetters(madrasaId);
  }
}

export const studentReportService = new StudentReportService();
