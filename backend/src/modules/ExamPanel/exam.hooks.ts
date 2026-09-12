/**
 * Routine-triggered exam-fee activation, called from
 * routine.service.ts's createExamRoutine. Kept in its own file (mirroring
 * exam-candidate.hooks.ts's split from routine.service.ts) so the routine
 * module depends on one narrow, purpose-built entry point instead of the
 * whole ExamPanel service surface.
 *
 * Unlike exam-candidate.hooks.ts, this is a plain top-level import rather
 * than a deferred require: there's no require-cycle to guard against here
 * (fee.service.ts never imports anything from ExamPanel, and exam.service.ts
 * doesn't import routine.service.ts), so the extra indirection would only
 * add complexity with no bug it's preventing.
 */
import { examService } from "./exam.service";
import { logger } from "../../shared/logger/logger";

/** No-ops once the exam is already active, so only the FIRST routine
 * created for a dormant exam actually activates its fee (invoices +
 * notification) - any later routine for the same exam is a no-op here.
 * Manual early activation (POST /exams/:id/activate-fee) still works at any
 * time; see ExamService.activateExamFee for what activation itself does.
 * Own try/catch at the call site in routine.service.ts already guarantees
 * this can never fail routine creation - this function itself doesn't need
 * to swallow errors, since the caller already does. */
export async function autoActivateExamFeeForRoutine(madrasaId: number, examId: number) {
  const exam = await examService.findExamForRoutineHook(examId, madrasaId);
  if (!exam || exam.isActive) return;

  await examService.activateExamFee(examId, madrasaId);
  logger.info(`Exam ${examId} fee auto-activated by its first routine (madrasa ${madrasaId})`);
}
