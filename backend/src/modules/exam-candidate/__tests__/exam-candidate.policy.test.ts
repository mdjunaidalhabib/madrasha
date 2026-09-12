import { describe, expect, it } from "vitest";
import { canCandidateParticipate, examCandidateParticipationSql } from "../exam-candidate.policy";

describe("canCandidateParticipate", () => {
  // Every ExamCandidateStatus x EligibilityStatus combination the
  // precedence rule needs to resolve unambiguously (see
  // exam-candidate.policy.ts's doc-comment for the rule itself).
  it("REGISTERED + PENDING participates (feature never used - legacy default)", () => {
    expect(canCandidateParticipate("REGISTERED", "PENDING")).toBe(true);
  });

  it("REGISTERED + ELIGIBLE participates", () => {
    expect(canCandidateParticipate("REGISTERED", "ELIGIBLE")).toBe(true);
  });

  it("REGISTERED + INELIGIBLE does NOT participate", () => {
    expect(canCandidateParticipate("REGISTERED", "INELIGIBLE")).toBe(false);
  });

  it("ELIGIBLE status + ELIGIBLE eligibility participates", () => {
    expect(canCandidateParticipate("ELIGIBLE", "ELIGIBLE")).toBe(true);
  });

  it("ELIGIBLE status + INELIGIBLE eligibility does NOT participate (eligibility overrides status)", () => {
    expect(canCandidateParticipate("ELIGIBLE", "INELIGIBLE")).toBe(false);
  });

  it("COMPLETED + ELIGIBLE participates (already-finished candidates still count)", () => {
    expect(canCandidateParticipate("COMPLETED", "ELIGIBLE")).toBe(true);
  });

  it("COMPLETED + PENDING participates", () => {
    expect(canCandidateParticipate("COMPLETED", "PENDING")).toBe(true);
  });

  it("CANCELLED never participates, even if eligibilityStatus says ELIGIBLE", () => {
    expect(canCandidateParticipate("CANCELLED", "ELIGIBLE")).toBe(false);
    expect(canCandidateParticipate("CANCELLED", "PENDING")).toBe(false);
    expect(canCandidateParticipate("CANCELLED", "INELIGIBLE")).toBe(false);
  });

  it("WITHHELD never participates, even if eligibilityStatus says ELIGIBLE", () => {
    expect(canCandidateParticipate("WITHHELD", "ELIGIBLE")).toBe(false);
    expect(canCandidateParticipate("WITHHELD", "PENDING")).toBe(false);
  });

  it("status = INELIGIBLE (a manual override, distinct from eligibilityStatus) does not participate", () => {
    expect(canCandidateParticipate("INELIGIBLE", "ELIGIBLE")).toBe(false);
  });

  it("treats a null/undefined eligibilityStatus the same as PENDING (participates)", () => {
    expect(canCandidateParticipate("REGISTERED", null)).toBe(true);
    expect(canCandidateParticipate("REGISTERED", undefined)).toBe(true);
  });
});

describe("examCandidateParticipationSql", () => {
  it("defaults to the 'ec' alias", () => {
    const sql = examCandidateParticipationSql();
    expect(sql).toContain("ec.status NOT IN ('CANCELLED', 'WITHHELD', 'INELIGIBLE')");
    expect(sql).toContain("ec.eligibility_status != 'INELIGIBLE'");
  });

  it("honors a custom alias", () => {
    const sql = examCandidateParticipationSql("cand");
    expect(sql).toContain("cand.status NOT IN ('CANCELLED', 'WITHHELD', 'INELIGIBLE')");
    expect(sql).toContain("cand.eligibility_status != 'INELIGIBLE'");
  });
});
