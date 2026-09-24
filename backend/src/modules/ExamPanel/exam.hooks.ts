/**
 * Routine-triggered exam activation, called from routine.service.ts's
 * createExamRoutine. Kept in its own file (mirroring exam-candidate.hooks.ts's
 * split from routine.service.ts) so the routine module depends on one narrow,
 * purpose-built entry point instead of the whole ExamPanel service surface.
 */
import { examService } from "./exam.service";
import { logger } from "../../shared/logger/logger";

/** A routine being scheduled means the exam is genuinely upcoming, so a
 * dormant exam is switched on. Only the exam - its পরীক্ষার ফি is ইহতেমাম's
 * own switch (ExamFeeService.setFeeActive) and is never started here. No-ops
 * once the exam is already active. The caller's own try/catch guarantees
 * this can never fail routine creation. */
export async function autoActivateExamForRoutine(madrasaId: number, examId: number) {
  const activated = await examService.activateExamForRoutine(examId, madrasaId);
  if (activated) logger.info(`Exam ${examId} auto-activated by its first routine (madrasa ${madrasaId})`);
}
