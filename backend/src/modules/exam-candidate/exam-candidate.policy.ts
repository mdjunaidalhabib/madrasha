import { ExamCandidateStatus, EligibilityStatus } from "@prisma/client";

/**
 * Canonical precedence rule between ExamCandidate.status and
 * ExamCandidate.eligibilityStatus - two deliberately independent fields
 * (see exam-candidate.prisma's model doc-comment), each answering a
 * different question:
 *
 *   - status:            is this registration itself still active, or has
 *                         it been withdrawn/held back by an admin action?
 *   - eligibilityStatus:  did the automatic eligibility engine (fee dues,
 *                         attendance %, admission approval, ...) last find
 *                         this candidate eligible?
 *
 * Both fields are kept (not collapsed into one) because collapsing them
 * would lose information: "REGISTERED, never checked" (PENDING) and
 * "REGISTERED, explicitly found INELIGIBLE" are different situations an
 * office needs to tell apart, and CANCELLED/WITHHELD are manual overrides
 * a status-only field can't express alongside an independent eligibility
 * snapshot.
 *
 * The combined precedence rule every "may this candidate actually
 * participate" decision must use:
 *
 *   1. status = CANCELLED  -> never participates, regardless of
 *      eligibilityStatus. A withdrawal - the row is kept for its audit
 *      history, but this candidate is out of the exam entirely.
 *   2. status = WITHHELD   -> administrative hold (e.g. disciplinary),
 *      distinct from the automatic eligibility engine - never
 *      participates until an admin explicitly releases it back to
 *      REGISTERED/ELIGIBLE. Also never participates, regardless of
 *      eligibilityStatus.
 *   3. status = INELIGIBLE (a distinct value in ExamCandidateStatus itself,
 *      not a typo for eligibilityStatus) OR eligibilityStatus = INELIGIBLE
 *      -> blocks participation even though the registration itself is
 *      still "active", so office staff can still see and fix the
 *      underlying eligibility issue (unpaid dues, low attendance, ...)
 *      instead of the registration silently vanishing. Concretely: no
 *      admit card, no new seat allocation, no attendance mark. These are
 *      two independent ways of arriving at "ineligible" - status is set
 *      directly by an admin (updateStatus/bulkUpdateStatus), eligibilityStatus
 *      by the automatic eligibility engine (checkEligibility/
 *      bulkCheckEligibility) - either one alone is enough to block.
 *   4. Otherwise (status REGISTERED/ELIGIBLE/COMPLETED, eligibilityStatus
 *      PENDING or ELIGIBLE) -> participates. PENDING is treated as "not
 *      yet disqualified", never as "blocked" - a madrasa that doesn't use
 *      the eligibility-check feature at all (every candidate stays
 *      PENDING forever) must keep working exactly as it did before that
 *      feature existed.
 *
 * Every module that decides who gets a seat/admit-card/attendance mark, or
 * who counts as a normal (non-flagged) result, MUST use this predicate (or
 * its SQL-fragment twin below) instead of re-deriving its own status/
 * eligibility condition. Known call sites this replaced: exam-seat.
 * repository.ts (seat allocation eligibility), exam-attendance.
 * repository.ts (roster for marking/bulk-mark), reports.repository.ts's
 * findStudentAdmitCards, and result-workflow.service.ts's verifyResult
 * cross-check.
 *
 * A pure "management roster" view (e.g. reports.repository.ts's
 * findExamCandidateList, the plain candidate-list report) is deliberately
 * NOT filtered through this predicate - office staff need to SEE
 * WITHHELD/INELIGIBLE registrations (clearly labeled via the status
 * columns) to act on them, not have them silently disappear. Only
 * CANCELLED (a true withdrawal) is excluded there.
 */
export function canCandidateParticipate(
  status: ExamCandidateStatus | string,
  eligibilityStatus: EligibilityStatus | string | null | undefined,
): boolean {
  // ExamCandidateStatus itself has an INELIGIBLE value (mirroring
  // EligibilityStatus.INELIGIBLE) - an admin can set it directly via
  // updateStatus/bulkUpdateStatus, independent of the automatic eligibility
  // engine ever running. Either one being INELIGIBLE blocks participation;
  // this is not a duplicate check, it's two independent ways of arriving
  // at the same disqualified state.
  if (status === "CANCELLED" || status === "WITHHELD" || status === "INELIGIBLE") return false;
  if (eligibilityStatus === "INELIGIBLE") return false;
  return true;
}

/** SQL fragment twin of canCandidateParticipate(), for the raw $queryRaw
 * repositories that filter at the database level instead of row-by-row in
 * JS. `alias` is the exam_candidates table alias used in that query
 * (defaults to "ec", the convention already used everywhere this applies). */
export function examCandidateParticipationSql(alias = "ec"): string {
  return `${alias}.status NOT IN ('CANCELLED', 'WITHHELD', 'INELIGIBLE') AND ${alias}.eligibility_status != 'INELIGIBLE'`;
}
