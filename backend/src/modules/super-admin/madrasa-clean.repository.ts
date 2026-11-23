import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";
import {
  MADRASA_CLEAN_SECTIONS,
  MadrasaCleanSection,
  resolveCleanSections,
} from "./madrasa-clean.dto";

export class MadrasaCleanRepository {
  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn, { timeout: 30000, maxWait: 10000 });
  }

  findMadrasaForClean(id: number) {
    return prisma.madrasa.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true, institutionType: true },
    });
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

  /** Clear selected sections and only the records linked to deleted people.
   * Full reset calls this with every section. Logins and settings survive. */
  wipeOperationalDataOnTx(
    tx: TransactionClient,
    id: number,
    sections: readonly MadrasaCleanSection[] = MADRASA_CLEAN_SECTIONS,
  ) {
    return (async () => {
      const selected = new Set(resolveCleanSections(sections));
      // Fees clear only their own linked income entries in the ledger.
      if (selected.has("fees")) {
        if (!selected.has("accounts")) {
          const payments = await tx.payment.findMany({
            where: { madrasaId: id },
            select: { accountEntryId: true },
          });
          const accountIds = payments.flatMap((row) =>
            row.accountEntryId == null ? [] : [row.accountEntryId],
          );
          if (accountIds.length)
            await tx.account.deleteMany({ where: { madrasaId: id, id: { in: accountIds } } });
        }
        await tx.payment.deleteMany({ where: { madrasaId: id } });
        await tx.studentFeeDiscount.deleteMany({ where: { madrasaId: id } });
        await tx.invoice.deleteMany({ where: { madrasaId: id } });
        await tx.feeStructure.deleteMany({ where: { madrasaId: id } });
      }
      // Ledger cleaning keeps fee payment and payroll records, detaching
      // their plain numeric pointers to the ledger entries being removed.
      if (selected.has("accounts")) {
        await tx.accountCategory.deleteMany({ where: { fund: { madrasaId: id } } });
        await tx.accountFund.deleteMany({ where: { madrasaId: id } });
        await tx.account.deleteMany({ where: { madrasaId: id } });
        await tx.payment.updateMany({ where: { madrasaId: id }, data: { accountEntryId: null } });
        await tx.payrollRecord.updateMany({
          where: { madrasaId: id },
          data: { accountEntryId: null },
        });
      }

      // Exam / result / routine (children before Exam/ExamRoom, which have
      // Restrict-type FKs pointing at them from ResultMaster/Mark/SeatAllocation)
      if (selected.has("exams")) {
        // Exam-only cleaning preserves invoices but removes obsolete exam fee definitions.
        if (!selected.has("fees")) {
          await tx.feeStructure.deleteMany({ where: { madrasaId: id, examId: { not: null } } });
        }
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
      }
      if (selected.has("routines")) await tx.classRoutine.deleteMany({ where: { madrasaId: id } });

      // Library issues (the book/category catalog itself is left as-is)
      if (selected.has("library")) {
        await tx.libraryBorrowRecord.deleteMany({ where: { madrasaId: id } });
        await tx.$executeRaw`UPDATE library_books SET copies_available = copies_total WHERE madrasa_id = ${id}`;
      }

      // Attendance
      if (selected.has("attendance")) {
        await tx.attendanceChange.deleteMany({ where: { madrasaId: id } });
        await tx.leaveRequest.deleteMany({ where: { madrasaId: id } });
        await tx.sessionAttendance.deleteMany({ where: { madrasaId: id } });
        await tx.attendanceDeviceLog.deleteMany({ where: { madrasaId: id } });
        await tx.smsQueue.deleteMany({ where: { madrasaId: id, source: "attendance" } });
        await tx.attendance.deleteMany({ where: { madrasaId: id } });
        await tx.attendancePolicy.updateMany({
          where: { madrasaId: id },
          data: { lastConsecutiveCheck: null },
        });
      }

      // Teachers / staff / payroll (children first; device user-maps and
      // library borrow rows cascade from Teacher/Staff, class routines are
      // already gone above). Their login Users and roles are NOT touched.
      if (selected.has("personnel")) {
        if (!selected.has("accounts")) {
          const payroll = await tx.payrollRecord.findMany({
            where: { madrasaId: id, accountEntryId: { not: null } },
            select: { accountEntryId: true },
          });
          const accountIds = payroll.flatMap((row) =>
            row.accountEntryId == null ? [] : [row.accountEntryId],
          );
          if (accountIds.length)
            await tx.account.deleteMany({ where: { madrasaId: id, id: { in: accountIds } } });
        }
        if (!selected.has("attendance")) await this.wipePersonAttendanceOnTx(tx, id, "personnel");
        if (!selected.has("library")) await this.wipePersonBorrowingOnTx(tx, id, "personnel");
        if (!selected.has("routines"))
          await tx.classRoutine.deleteMany({ where: { madrasaId: id, teacherId: { not: null } } });
        await tx.examInvigilatorAssignment.deleteMany({ where: { madrasaId: id } });
        await tx.payrollRecord.deleteMany({ where: { madrasaId: id } });
        await tx.teacherAssignment.deleteMany({ where: { madrasaId: id } });
        await tx.teacher.deleteMany({ where: { madrasaId: id } });
        await tx.staff.deleteMany({ where: { madrasaId: id } });
        await tx.attendanceDeviceEnrollment.deleteMany({
          where: { madrasaId: id, attendeeType: { in: ["TEACHER", "STAFF"] } },
        });
        await tx.personnelNumberReservation.deleteMany({
          where: { madrasaId: id, kind: { in: ["teacher-registration", "staff-registration"] } },
        });
      }

      // Promotion history
      if (selected.has("students")) {
        if (!selected.has("fees")) {
          // Payment.accountEntryId is the explicit link to the income ledger.
          // Never infer student payments from a category, name or description.
          const paymentWhere = { madrasaId: id, invoice: { student: { madrasaId: id } } };
          const payments = await tx.payment.findMany({
            where: paymentWhere,
            select: { accountEntryId: true },
          });
          const accountIds = payments.flatMap((row) =>
            row.accountEntryId == null ? [] : [row.accountEntryId],
          );
          await tx.payment.deleteMany({ where: paymentWhere });
          await tx.studentFeeDiscount.deleteMany({
            where: { madrasaId: id, student: { madrasaId: id } },
          });
          await tx.invoice.deleteMany({ where: { madrasaId: id, student: { madrasaId: id } } });
          if (!selected.has("accounts") && accountIds.length)
            await tx.account.deleteMany({ where: { madrasaId: id, id: { in: accountIds } } });
        }
        if (!selected.has("exams")) {
          // All student records in this institution are being cleared. Remove
          // their result data, retaining exam definitions, routines and rooms.
          await tx.markComponentValue.deleteMany({ where: { mark: { madrasaId: id } } });
          await tx.mark.deleteMany({ where: { madrasaId: id } });
          await tx.markSubmission.deleteMany({ where: { madrasaId: id } });
          await tx.resultCorrection.deleteMany({ where: { madrasaId: id } });
          await tx.resultSnapshot.deleteMany({ where: { madrasaId: id } });
          await tx.resultSummary.deleteMany({ where: { resultMaster: { madrasaId: id } } });
          await tx.resultMaster.deleteMany({ where: { madrasaId: id } });
          // Seat allocations and exam attendance cascade from candidates.
          await tx.examCandidate.deleteMany({
            where: { madrasaId: id, student: { madrasaId: id } },
          });
        }
        if (!selected.has("attendance")) await this.wipePersonAttendanceOnTx(tx, id, "students");
        if (!selected.has("library")) await this.wipePersonBorrowingOnTx(tx, id, "students");
        await tx.promotionRecord.deleteMany({ where: { batch: { madrasaId: id } } });
        await tx.promotionBatch.deleteMany({ where: { madrasaId: id } });

        // Students & guardians (after every table referencing them above is gone)
        await tx.guardianStudent.deleteMany({ where: { guardian: { madrasaId: id } } });
        await tx.guardian.deleteMany({ where: { madrasaId: id } });
        await tx.studentSessionHistory.deleteMany({ where: { madrasaId: id } });
        await tx.student.deleteMany({ where: { madrasaId: id } });

        // Public admission applications
        await tx.websiteAdmissionApplication.deleteMany({ where: { madrasaId: id } });
        await tx.attendanceDeviceEnrollment.deleteMany({
          where: { madrasaId: id, attendeeType: "STUDENT" },
        });
        // A super-admin clean is a fresh start, including previously issued numbers.
        await tx.personnelNumberReservation.deleteMany({
          where: { madrasaId: id, kind: { in: ["student-registration", "student-roll"] } },
        });
        await tx.madrasaClass.updateMany({
          where: { madrasaId: id },
          data: { regNoLastIssued: null },
        });
      }

      // Notifications & activity log
      if (selected.has("logs")) {
        await tx.notificationLog.deleteMany({ where: { madrasaId: id } });
        await tx.activityLog.deleteMany({ where: { madrasaId: id } });
        await tx.smsQueue.deleteMany({ where: { madrasaId: id } });
      }
    })();
  }

  private async wipePersonAttendanceOnTx(
    tx: TransactionClient,
    id: number,
    section: "students" | "personnel",
  ) {
    const attendeeType =
      section === "students"
        ? ("STUDENT" as const)
        : { in: ["TEACHER", "STAFF"] as ("TEACHER" | "STAFF")[] };
    const where = { madrasaId: id, attendeeType };
    await tx.attendanceChange.deleteMany({ where });
    await tx.leaveRequest.deleteMany({ where });
    await tx.attendance.deleteMany({ where });
    if (section === "students") {
      await tx.sessionAttendance.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceDeviceLog.deleteMany({
        where: { madrasaId: id, studentId: { not: null } },
      });
      await tx.smsQueue.deleteMany({ where: { madrasaId: id, studentId: { not: null } } });
    } else {
      await tx.attendanceDeviceLog.deleteMany({
        where: { madrasaId: id, OR: [{ teacherId: { not: null } }, { staffId: { not: null } }] },
      });
    }
  }

  private async wipePersonBorrowingOnTx(
    tx: TransactionClient,
    id: number,
    section: "students" | "personnel",
  ) {
    const where = {
      madrasaId: id,
      ...(section === "students" ? { studentId: { not: null } } : { teacherId: { not: null } }),
    };
    const borrowed = await tx.libraryBorrowRecord.groupBy({
      by: ["bookId"],
      where: { ...where, status: "BORROWED" },
      _count: { _all: true },
    });
    await tx.libraryBorrowRecord.deleteMany({ where });
    // Return only the copies held by the people being cleaned. Other loans remain.
    for (const row of borrowed) {
      await tx.libraryBook.updateMany({
        where: { madrasaId: id, id: row.bookId },
        data: { copiesAvailable: { increment: row._count._all } },
      });
    }
  }

  /** Factory-reset: everything wipeOperationalDataOnTx removes, PLUS
   * settings, academic structure, website/branding
   * content, document templates and every login (users/roles). Only the
   * Madrasa row itself and its plan/subscription/billing history survive -
   * the service then provisions defaults and restores the main admin login. */
  wipeFullDataOnTx(tx: TransactionClient, id: number) {
    return (async () => {
      await this.wipeOperationalDataOnTx(tx, id);
      await tx.personnelNumberReservation.deleteMany({ where: { madrasaId: id } });

      // Fee & library settings/catalog
      await tx.paymentMethodSetting.deleteMany({ where: { madrasaId: id } });
      await tx.feeCategory.deleteMany({ where: { madrasaId: id } });
      await tx.libraryBook.deleteMany({ where: { madrasaId: id } });
      await tx.libraryBookCategory.deleteMany({ where: { madrasaId: id } });

      // Biometric (K40) devices + their punch logs, user maps, card
      // enrollments, attendance rules/holidays, SMS queue.
      await tx.attendanceDeviceLog.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceDeviceEnrollment.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceDeviceUserMap.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceDeviceSettings.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceHoliday.deleteMany({ where: { madrasaId: id } });
      await tx.attendancePolicy.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceSession.deleteMany({ where: { madrasaId: id } });
      await tx.attendanceDevice.deleteMany({ where: { madrasaId: id } });
      await tx.smsQueue.deleteMany({ where: { madrasaId: id } });

      // Academic structure & sessions (safe now - nothing with a Restrict FK
      // to Session/MadrasaDivision/MadrasaClass/MadrasaBook remains)
      await tx.session.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaDivision.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaClass.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaBook.deleteMany({ where: { madrasaId: id } });
      await tx.generalGrade.deleteMany({ where: { madrasaId: id } });
      await tx.madrasaGrade.deleteMany({ where: { madrasaId: id } });
      await tx.markComponentConfig.deleteMany({ where: { madrasaId: id } });
      await tx.academicSequence.deleteMany({ where: { madrasaId: id } });

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
