import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class MadrasaCleanRepository {
  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn, { timeout: 30000, maxWait: 10000 });
  }

  findMadrasaForClean(id: number) {
    return prisma.madrasa.findUnique({ where: { id }, select: { id: true, name: true, deletedAt: true } });
  }

  countCleanStats(id: number) {
    return Promise.all([
      prisma.student.count({ where: { madrasaId: id } }),
      prisma.invoice.count({ where: { madrasaId: id } }),
      prisma.exam.count({ where: { madrasaId: id } }),
      prisma.attendance.count({ where: { madrasaId: id } }),
      prisma.user.count({ where: { madrasaId: id } }),
      prisma.staff.count({ where: { madrasaId: id } }),
      prisma.teacher.count({ where: { madrasaId: id } }),
    ]);
  }

  /** Wipes every day-to-day operational/transactional record for this
   * tenant - students, guardians, fees/invoices/payments, accounting
   * ledger, attendance, exams/results, library issues, routines,
   * admission applications, notifications, activity log - while leaving
   * the madrasa's settings, academic structure (division/class/book
   * mapping), staff/teacher rosters, user logins and roles untouched. Safe
   * to run repeatedly (each step is a scoped deleteMany). Order matters:
   * dependents are deleted before anything a Restrict-type FK still points
   * at (e.g. ResultMaster/Mark before Exam, SeatAllocation before
   * ExamRoom) - see backend/prisma/models/*.prisma for the relations this
   * mirrors. */
  wipeOperationalDataOnTx(tx: TransactionClient, id: number) {
    return (async () => {
      // Fee / accounting
      await tx.payment.deleteMany({ where: { madrasaId: id } });
      await tx.studentFeeDiscount.deleteMany({ where: { madrasaId: id } });
      await tx.invoice.deleteMany({ where: { madrasaId: id } });
      await tx.feeStructure.deleteMany({ where: { madrasaId: id } });
      await tx.accountCategory.deleteMany({ where: { fund: { madrasaId: id } } });
      await tx.accountFund.deleteMany({ where: { madrasaId: id } });
      await tx.account.deleteMany({ where: { madrasaId: id } });

      // Exam / result / routine (children before Exam/ExamRoom, which have
      // Restrict-type FKs pointing at them from ResultMaster/Mark/SeatAllocation)
      await tx.seatAllocation.deleteMany({ where: { madrasaId: id } });
      await tx.examAttendance.deleteMany({ where: { madrasaId: id } });
      await tx.examInvigilatorAssignment.deleteMany({ where: { madrasaId: id } });
      await tx.markComponentValue.deleteMany({ where: { mark: { madrasaId: id } } });
      await tx.markSubmission.deleteMany({ where: { madrasaId: id } });
      await tx.resultCorrection.deleteMany({ where: { madrasaId: id } });
      await tx.resultSnapshot.deleteMany({ where: { madrasaId: id } });
      await tx.resultSummary.deleteMany({ where: { resultMaster: { madrasaId: id } } });
      await tx.mark.deleteMany({ where: { madrasaId: id } });
      await tx.resultMaster.deleteMany({ where: { madrasaId: id } });
      await tx.examCandidate.deleteMany({ where: { madrasaId: id } });
      await tx.examRoutine.deleteMany({ where: { madrasaId: id } });
      await tx.examRoom.deleteMany({ where: { madrasaId: id } });
      await tx.exam.deleteMany({ where: { madrasaId: id } });
      await tx.classRoutine.deleteMany({ where: { madrasaId: id } });

      // Library issues (the book/category catalog itself is left as-is)
      await tx.libraryBorrowRecord.deleteMany({ where: { madrasaId: id } });

      // Attendance
      await tx.attendance.deleteMany({ where: { madrasaId: id } });

      // Promotion history
      await tx.promotionRecord.deleteMany({ where: { batch: { madrasaId: id } } });
      await tx.promotionBatch.deleteMany({ where: { madrasaId: id } });

      // Students & guardians (after every table referencing them above is gone)
      await tx.guardianStudent.deleteMany({ where: { guardian: { madrasaId: id } } });
      await tx.guardian.deleteMany({ where: { madrasaId: id } });
      await tx.studentSessionHistory.deleteMany({ where: { madrasaId: id } });
      await tx.student.deleteMany({ where: { madrasaId: id } });

      // Public admission applications
      await tx.websiteAdmissionApplication.deleteMany({ where: { madrasaId: id } });

      // Notifications & activity log
      await tx.notificationLog.deleteMany({ where: { madrasaId: id } });
      await tx.activityLog.deleteMany({ where: { madrasaId: id } });
    })();
  }

  /** Factory-reset: everything wipeOperationalDataOnTx removes, PLUS
   * settings, academic structure, staff/teacher rosters, website/branding
   * content, document templates and every login (users/roles). Only the
   * Madrasa row itself and its plan/subscription/billing history survive -
   * afterwards nobody can log into this tenant until a super admin creates
   * a fresh user. */
  wipeFullDataOnTx(tx: TransactionClient, id: number) {
    return (async () => {
      await this.wipeOperationalDataOnTx(tx, id);

      // Fee & library settings/catalog
      await tx.paymentMethodSetting.deleteMany({ where: { madrasaId: id } });
      await tx.feeCategory.deleteMany({ where: { madrasaId: id } });
      await tx.libraryBook.deleteMany({ where: { madrasaId: id } });
      await tx.libraryBookCategory.deleteMany({ where: { madrasaId: id } });

      // Staff / teachers / payroll / kiosk hardware
      await tx.payrollRecord.deleteMany({ where: { madrasaId: id } });
      await tx.teacherAssignment.deleteMany({ where: { madrasaId: id } });
      await tx.teacher.deleteMany({ where: { madrasaId: id } });
      await tx.staff.deleteMany({ where: { madrasaId: id } });
      await tx.kioskDevice.deleteMany({ where: { madrasaId: id } });

      // Academic structure & sessions (safe now - nothing with a Restrict FK
      // to Session/MadrasaDivision/MadrasaClass/MadrasaBook remains)
      await tx.session.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaDivision.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaClass.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaBook.deleteMany({ where: { madrasaId: id } });
      await tx.generalGrade.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaGrade.deleteMany({ where: { madrasaId: id } });
      await tx.markComponentConfig.deleteMany({ where: { madrasaId: id } });

      // Document templates & public website/branding content
      await tx.tenantDocumentDefault.deleteMany({ where: { madrasaId: id } });
      await tx.documentTemplate.deleteMany({ where: { tenantId: id } });
      await tx.websiteGallery.deleteMany({ where: { madrasaId: id } });
      await tx.websiteSlide.deleteMany({ where: { madrasaId: id } });
      await tx.websiteCommitteeMember.deleteMany({ where: { madrasaId: id } });
      await tx.websiteNotice.deleteMany({ where: { madrasaId: id } });
      await tx.printableNotice.deleteMany({ where: { madrasaId: id } });
      await tx.websitePage.deleteMany({ where: { madrasaId: id } });
      await tx.websiteSettings.deleteMany({ where: { madrasaId: id } });

      // Settings & notification preferences
      await tx.setting.deleteMany({ where: { madrasaId: id } });
      await tx.notificationSetting.deleteMany({ where: { madrasaId: id } });

      // Logins & roles - last, since nothing above still references them
      await tx.passwordResetToken.deleteMany({ where: { madrasaId: id } });
      await tx.refreshToken.deleteMany({ where: { madrasaId: id } });
      await tx.rolePermission.deleteMany({ where: { role: { madrasaId: id } } });
      await tx.user.deleteMany({ where: { madrasaId: id } });
      await tx.role.deleteMany({ where: { madrasaId: id } });
    })();
  }
}

export const madrasaCleanRepository = new MadrasaCleanRepository();
