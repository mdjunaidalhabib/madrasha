import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock("../../ResultPanel/result-panel.repository", () => ({ resultPanelRepository: {} }));

import { logActivity } from "../../../shared/utils/activity.util";
import { TrashService } from "../trash.service";

type Master = { id: number; status: string; examName: string; examYear: string | null };

function build(opts: { impact: { masters: Master[] } | null; restoredCount?: number }) {
  const restoreCalls: { id: number; madrasaId: number; ids: number[]; note: string }[] = [];
  const repository = {
    findStudentRestoreImpact: async () => opts.impact,
    restoreStudentAndReopenResults: async (id: number, madrasaId: number, ids: number[], note: string) => {
      restoreCalls.push({ id, madrasaId, ids, note });
      return { count: opts.restoredCount ?? 1 };
    },
  };
  return { service: new TrashService(repository as any), restoreCalls };
}

const master = (id: number, status: string): Master => ({ id, status, examName: `Exam ${id}`, examYear: "2026" });

describe("TrashService.restoreStudent - result safety", () => {
  beforeEach(() => vi.mocked(logActivity).mockClear());

  it("restores without touching any result when the student is in none of them", async () => {
    const { service, restoreCalls } = build({ impact: { masters: [] } });
    const out = await service.restoreStudent(5, 1, 9);
    expect(restoreCalls[0].ids).toEqual([]);
    expect(out.reopened).toEqual([]);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("re-opens every processed/published result the student is missing from", async () => {
    const { service, restoreCalls } = build({
      impact: { masters: [master(10, "PUBLISHED"), master(11, "APPROVED"), master(12, "PROCESSING")] },
    });
    const out = await service.restoreStudent(5, 1, 9);
    expect(restoreCalls[0].ids).toEqual([10, 11, 12]);
    expect(out.reopened.map((r) => r.result_master_id)).toEqual([10, 11, 12]);
    expect(out.locked_skipped).toEqual([]);
    expect(logActivity).toHaveBeenCalledTimes(3);
    expect(vi.mocked(logActivity).mock.calls[0][0]).toMatchObject({
      madrasa_id: 1,
      user_id: 9,
      action: "REOPEN",
      entity: "results/reopen",
      entity_id: 10,
    });
  });

  it("never re-opens a LOCKED result - it is reported as skipped instead", async () => {
    const { service, restoreCalls } = build({
      impact: { masters: [master(10, "LOCKED"), master(11, "PUBLISHED")] },
    });
    const out = await service.restoreStudent(5, 1, 9);
    expect(restoreCalls[0].ids).toEqual([11]);
    expect(out.locked_skipped.map((r) => r.result_master_id)).toEqual([10]);
  });

  it("404s when the student is not in the trash", async () => {
    const { service } = build({ impact: null });
    await expect(service.restoreStudent(5, 1, 9)).rejects.toThrow();
  });

  it("404s (and logs nothing) if the student vanished between check and write", async () => {
    const { service } = build({ impact: { masters: [master(10, "PUBLISHED")] }, restoredCount: 0 });
    await expect(service.restoreStudent(5, 1, 9)).rejects.toThrow();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("restore-impact flags LOCKED results as will_reopen=false", async () => {
    const { service } = build({ impact: { masters: [master(10, "LOCKED"), master(11, "APPROVED")] } });
    const rows = await service.getStudentRestoreImpact(5, 1);
    expect(rows.map((r) => [r.result_master_id, r.will_reopen])).toEqual([
      [10, false],
      [11, true],
    ]);
  });
});
