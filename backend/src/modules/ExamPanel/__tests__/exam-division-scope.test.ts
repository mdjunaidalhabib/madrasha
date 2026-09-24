import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../fee/exam-fee.service", () => ({ examFeeService: { syncExam: vi.fn(), deactivateFee: vi.fn() } }));
vi.mock("../../session/session.repository", () => ({ sessionRepository: {} }));
vi.mock("../../ResultPanel/result-panel.service", () => ({
  resultPanelService: { recalculateResults: vi.fn() },
}));

import { ExamService } from "../exam.service";
import { examFeeService } from "../../fee/exam-fee.service";
import { ConflictError, BadRequestError } from "../../../shared/errors";

const MADRASA_ID = 1;
const HIFZ = 1;
const KITAB = 2;
const NAZERA = 3;

type ExamRow = { id: number; name: string; year: string; divisions: { divisionId: number }[] };

function build(existing: ExamRow[] = []) {
  const repository = {
    findActiveDivisions: vi.fn(async () => [HIFZ, KITAB, NAZERA].map((divisionId) => ({ divisionId }))),
    findExamsByNameAndYear: vi.fn(async (_m: number, name: string, year: string) =>
      existing.filter((e) => e.name === name && e.year === year),
    ),
    findExamById: vi.fn(async (id: number) => existing.find((e) => e.id === id) ?? null),
    createExam: vi.fn(async (..._args: unknown[]) => ({})),
    updateExam: vi.fn(async (..._args: unknown[]) => ({ count: 1 })),
  };
  const sessions = { findCurrentSession: vi.fn(async () => ({ name: "2026" })) };
  const service = new ExamService(repository as any, sessions as any);
  return { service, repository };
}

describe("বিভাগভিত্তিক পরীক্ষা", () => {
  it("creates an exam scoped to the chosen divisions", async () => {
    const { service, repository } = build();
    await service.createExam(MADRASA_ID, { name: "বার্ষিক", division_ids: [KITAB, HIFZ, KITAB] });
    expect(repository.createExam).toHaveBeenCalledWith(MADRASA_ID, "বার্ষিক", "2026", expect.anything(), [HIFZ, KITAB]);
  });

  it("normalises 'every active division' to সকল বিভাগ (empty scope)", async () => {
    const { service, repository } = build();
    await service.createExam(MADRASA_ID, { name: "বার্ষিক", division_ids: [HIFZ, KITAB, NAZERA] });
    expect(repository.createExam.mock.calls[0][4]).toEqual([]);
  });

  it("rejects a division that is not active in the madrasa", async () => {
    const { service } = build();
    await expect(service.createExam(MADRASA_ID, { name: "বার্ষিক", division_ids: [99] })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("allows the same name+year for non-overlapping divisions", async () => {
    const { service, repository } = build([{ id: 5, name: "বার্ষিক", year: "2026", divisions: [{ divisionId: HIFZ }] }]);
    await service.createExam(MADRASA_ID, { name: "বার্ষিক", division_ids: [KITAB] });
    expect(repository.createExam).toHaveBeenCalled();
  });

  it("blocks the same name+year when divisions overlap or either side is সকল বিভাগ", async () => {
    const scoped = build([{ id: 5, name: "বার্ষিক", year: "2026", divisions: [{ divisionId: HIFZ }] }]);
    await expect(
      scoped.service.createExam(MADRASA_ID, { name: "বার্ষিক", division_ids: [HIFZ, KITAB] }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(scoped.service.createExam(MADRASA_ID, { name: "বার্ষিক" })).rejects.toBeInstanceOf(ConflictError);

    const all = build([{ id: 6, name: "বার্ষিক", year: "2026", divisions: [] }]);
    await expect(all.service.createExam(MADRASA_ID, { name: "বার্ষিক", division_ids: [NAZERA] })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("an exam never conflicts with itself on update, and passes the new scope through", async () => {
    const { service, repository } = build([{ id: 5, name: "বার্ষিক", year: "2026", divisions: [{ divisionId: HIFZ }] }]);
    await service.updateExam(5, MADRASA_ID, { division_ids: [HIFZ, NAZERA] });
    expect(repository.updateExam).toHaveBeenCalledWith(5, MADRASA_ID, {}, [HIFZ, NAZERA]);
  });

  it("leaves the scope untouched when division_ids is omitted", async () => {
    const { service, repository } = build([{ id: 5, name: "বার্ষিক", year: "2026", divisions: [] }]);
    await service.updateExam(5, MADRASA_ID, { is_active: false });
    expect(repository.updateExam).toHaveBeenCalledWith(5, MADRASA_ID, { isActive: false }, undefined);
    expect(repository.findExamsByNameAndYear).not.toHaveBeenCalled();
  });
});

describe("তা'লীমাত পরীক্ষা চালু/বন্ধ vs ইহতেমাম পরীক্ষার ফি", () => {
  it("switching the exam off also switches its fee off", async () => {
    const { service } = build([{ id: 5, name: "বার্ষিক", year: "2026", divisions: [] }]);
    vi.mocked(examFeeService.deactivateFee).mockClear();
    await service.updateExam(5, MADRASA_ID, { is_active: false });
    expect(examFeeService.deactivateFee).toHaveBeenCalledWith(MADRASA_ID, 5);
  });

  it("switching the exam on never starts its fee", async () => {
    const { service, repository } = build([{ id: 5, name: "বার্ষিক", year: "2026", divisions: [] }]);
    vi.mocked(examFeeService.deactivateFee).mockClear();
    await service.updateExam(5, MADRASA_ID, { is_active: true });
    expect(repository.updateExam).toHaveBeenCalledWith(5, MADRASA_ID, { isActive: true }, undefined);
    expect(examFeeService.deactivateFee).not.toHaveBeenCalled();
  });
});
