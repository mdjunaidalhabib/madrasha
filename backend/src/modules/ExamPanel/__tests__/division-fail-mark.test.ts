import { beforeEach, describe, expect, it, vi } from "vitest";

// ExamService only talks to its injected repository; everything that would
// otherwise open a DB connection at import time is stubbed.
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../fee/fee.service", () => ({ feeService: {} }));
vi.mock("../../fee/exam-fee.service", () => ({ examFeeService: { syncExam: vi.fn() } }));
vi.mock("../../session/session.repository", () => ({ sessionRepository: {} }));
vi.mock("../../ResultPanel/result-panel.service", () => ({
  resultPanelService: { recalculateResults: vi.fn() },
}));

import { resultPanelService } from "../../ResultPanel/result-panel.service";
import { ExamService } from "../exam.service";

type Grade = {
  id: number;
  name: string;
  minMark: number;
  maxMark: number;
  point: number | null;
  divisionId: number | null;
};

const MADRASA_ID = 1;
const DIV = 7;

/** In-memory stand-in for ExamRepository: rows live in plain arrays, scope-aware like the real queries. */
function buildFakeRepository(opts: { divisionFailMark?: number | null; divisionExists?: boolean } = {}) {
  let nextId = 100;
  const state = {
    globalFailMark: "35",
    divisionFailMark: opts.divisionFailMark ?? null,
    general: [
      { id: 1, name: "A+", minMark: 80, maxMark: 100, point: 5, divisionId: null },
      { id: 2, name: "B", minMark: 50, maxMark: 79, point: 3, divisionId: null },
      { id: 3, name: "D", minMark: 36, maxMark: 49, point: 1, divisionId: null },
    ] as Grade[],
    madrasa: [
      { id: 11, name: "Mumtaz", minMark: 80, maxMark: 100, point: null, divisionId: null },
      { id: 12, name: "Maqbul", minMark: 36, maxMark: 79, point: null, divisionId: null },
    ] as Grade[],
  };
  const sortDesc = (rows: Grade[]) => [...rows].sort((a, b) => b.maxMark - a.maxMark || b.id - a.id);
  const insertMany = (list: Grade[], divisionId: number, grades: Grade[]) => {
    list.push(...grades.map((g) => ({ ...g, id: nextId++, divisionId })));
  };
  const updateIn =
    (list: Grade[]) => async (id: number, _madrasaId: number, name: string, min: number, max: number, point: number | null) => {
      const row = list.find((g) => g.id === id);
      if (row) Object.assign(row, { name, minMark: min, maxMark: max, point });
      return { count: row ? 1 : 0 };
    };

  const repository = {
    findFailMarkSetting: vi.fn(async () => ({ value: state.globalFailMark })),
    upsertFailMarkSetting: vi.fn(async (_m: number, value: string) => {
      state.globalFailMark = value;
    }),
    findActiveDivision: vi.fn(async (_m: number, divisionId: number) =>
      opts.divisionExists === false || divisionId !== DIV ? null : { divisionId, failMark: state.divisionFailMark },
    ),
    setDivisionFailMark: vi.fn(async (_m: number, _d: number, value: number | null) => {
      state.divisionFailMark = value;
      return { count: 1 };
    }),
    clearDivisionOverride: vi.fn(async (_m: number, divisionId: number) => {
      state.divisionFailMark = null;
      state.general = state.general.filter((g) => g.divisionId !== divisionId);
      state.madrasa = state.madrasa.filter((g) => g.divisionId !== divisionId);
    }),
    findGeneralGrades: vi.fn(async (_m: number, divisionId: number | null = null) =>
      sortDesc(state.general.filter((g) => g.divisionId === divisionId)),
    ),
    findMadrasaGrades: vi.fn(async (_m: number, divisionId: number | null = null) =>
      sortDesc(state.madrasa.filter((g) => g.divisionId === divisionId)),
    ),
    createManyGeneralGrades: vi.fn(async (_m: number, d: number, grades: Grade[]) => insertMany(state.general, d, grades)),
    createManyMadrasaGrades: vi.fn(async (_m: number, d: number, grades: Grade[]) => insertMany(state.madrasa, d, grades)),
    createGeneralGrade: vi.fn(async () => undefined),
    createMadrasaGrade: vi.fn(async () => undefined),
    // Row arrays get reassigned by clearDivisionOverride, so resolve them lazily.
    updateGeneralGrade: vi.fn((...args: Parameters<ReturnType<typeof updateIn>>) => updateIn(state.general)(...args)),
    updateMadrasaGrade: vi.fn((...args: Parameters<ReturnType<typeof updateIn>>) => updateIn(state.madrasa)(...args)),
    findActiveDivisions: vi.fn(async () => [
      { divisionId: DIV, failMark: state.divisionFailMark, division: { name: "Hifz", nameBn: "Hifz-bn" } },
      { divisionId: 8, failMark: null, division: { name: "Kitab", nameBn: null } },
    ]),
    findDivisionIdsWithOwnGrades: vi.fn(
      async () => new Set(state.general.filter((g) => g.divisionId !== null).map((g) => g.divisionId as number)),
    ),
    findClassDivisionId: vi.fn(async () => DIV),
  };
  return { repository, state };
}

const makeService = (opts?: Parameters<typeof buildFakeRepository>[0]) => {
  const fake = buildFakeRepository(opts);
  const service = new ExamService(fake.repository as any, {} as any);
  return { ...fake, service };
};

const recalc = resultPanelService.recalculateResults as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  recalc.mockReset();
  recalc.mockResolvedValue({ totals: { updated: 4, changed_students: 2, pending_published: 1, failed: 0 } });
});

describe("updateDivisionFailMark", () => {
  it("first override clones the default scales into the division and repins its lowest bands", async () => {
    const { service, state, repository } = makeService();

    const result = await service.updateDivisionFailMark(MADRASA_ID, DIV, { value: 40 });

    expect(state.divisionFailMark).toBe(40);
    const own = state.general.filter((g) => g.divisionId === DIV);
    expect(own.map((g) => g.name).sort()).toEqual(["A+", "B", "D"]);
    // lowest band pinned to failMark (pass starts AT it); upper bands copied unchanged
    expect(own.find((g) => g.name === "D")).toMatchObject({ minMark: 40, maxMark: 49, point: 1 });
    expect(own.find((g) => g.name === "A+")).toMatchObject({ minMark: 80, maxMark: 100 });
    const ownMadrasa = state.madrasa.filter((g) => g.divisionId === DIV);
    expect(ownMadrasa).toHaveLength(2);
    expect(ownMadrasa.find((g) => g.name === "Maqbul")?.minMark).toBe(40);

    // default scale untouched
    expect(state.general.find((g) => g.id === 3)?.minMark).toBe(36);
    expect(repository.createManyGeneralGrades).toHaveBeenCalledTimes(1);

    // Saving a setting never re-grades results; that is an explicit পুনঃগণনা.
    expect(recalc).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("an existing own scale is not re-cloned, only repinned (clamped to the band's max)", async () => {
    const { service, state, repository } = makeService({ divisionFailMark: 40 });
    state.general.push({ id: 50, name: "C", minMark: 41, maxMark: 60, point: 2, divisionId: DIV });
    state.general.push({ id: 51, name: "D", minMark: 41, maxMark: 45, point: 1, divisionId: DIV });

    await service.updateDivisionFailMark(MADRASA_ID, DIV, { value: 50 });

    expect(repository.createManyGeneralGrades).not.toHaveBeenCalled();
    // pinned floor 51 would exceed the band's max 45 -> clamped to 45
    expect(state.general.find((g) => g.id === 51)?.minMark).toBe(45);
    expect(state.general.find((g) => g.id === 50)?.minMark).toBe(41);
    expect(state.divisionFailMark).toBe(50);
  });

  it("null clears the override and deletes the division's own rows", async () => {
    const { service, state, repository } = makeService({ divisionFailMark: 40 });
    state.general.push({ id: 50, name: "D", minMark: 41, maxMark: 49, point: 1, divisionId: DIV });
    state.madrasa.push({ id: 60, name: "Maqbul", minMark: 41, maxMark: 79, point: null, divisionId: DIV });

    await service.updateDivisionFailMark(MADRASA_ID, DIV, { value: null });

    expect(repository.clearDivisionOverride).toHaveBeenCalledWith(MADRASA_ID, DIV);
    expect(state.divisionFailMark).toBeNull();
    expect(state.general.some((g) => g.divisionId === DIV)).toBe(false);
    expect(state.madrasa.some((g) => g.divisionId === DIV)).toBe(false);
    expect(state.general.filter((g) => g.divisionId === null)).toHaveLength(3);
    expect(recalc).not.toHaveBeenCalled();
  });

  it("rejects unknown divisions and out-of-range values", async () => {
    const { service, repository } = makeService({ divisionExists: false });
    await expect(service.updateDivisionFailMark(MADRASA_ID, DIV, { value: 101 })).rejects.toThrow("between 0 and 100");
    await expect(service.updateDivisionFailMark(MADRASA_ID, DIV, { value: 40 })).rejects.toThrow("Division not found");
    expect(repository.setDivisionFailMark).not.toHaveBeenCalled();
  });
});

describe("updateFailMark (global)", () => {
  it("only repins the default scale, never division-owned rows", async () => {
    const { service, state, repository } = makeService({ divisionFailMark: 40 });
    state.general.push({ id: 50, name: "D", minMark: 41, maxMark: 49, point: 1, divisionId: DIV });

    await service.updateFailMark(MADRASA_ID, { value: 30 });

    expect(state.globalFailMark).toBe("30");
    expect(state.general.find((g) => g.id === 3)?.minMark).toBe(30); // default scale repinned
    expect(state.general.find((g) => g.id === 50)?.minMark).toBe(41); // division scale untouched
    for (const call of repository.findGeneralGrades.mock.calls) expect(call[1]).toBeNull();
    expect(recalc).not.toHaveBeenCalled();
  });
});

describe("scope-guarded grade create", () => {
  const dto = { name: "X", min_mark: 10, max_mark: 20 };

  it("default scope (no division_id) creates with a null scope", async () => {
    const { service, repository } = makeService();
    await service.saveGeneralGrade(MADRASA_ID, dto);
    expect(repository.createGeneralGrade).toHaveBeenCalledWith(MADRASA_ID, "X", 10, 20, null, null);
  });

  it("division scope without an override is a 400", async () => {
    const { service, repository } = makeService({ divisionFailMark: null });
    await expect(service.saveGeneralGrade(MADRASA_ID, { ...dto, division_id: DIV })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.saveMadrasaGrade(MADRASA_ID, { ...dto, division_id: DIV })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repository.createGeneralGrade).not.toHaveBeenCalled();
    expect(repository.createMadrasaGrade).not.toHaveBeenCalled();
  });

  it("division scope with an override creates into that division", async () => {
    const { service, repository } = makeService({ divisionFailMark: 40 });
    await service.saveMadrasaGrade(MADRASA_ID, { ...dto, division_id: DIV });
    expect(repository.createMadrasaGrade).toHaveBeenCalledWith(MADRASA_ID, "X", 10, 20, null, DIV);
  });

  it("unknown division is a 400", async () => {
    const { service } = makeService({ divisionExists: false });
    await expect(service.saveGeneralGrade(MADRASA_ID, { ...dto, division_id: DIV })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("reads", () => {
  it("lists the default scale by default and a division's rows with division_id, each row tagged", async () => {
    const { service, state } = makeService({ divisionFailMark: 40 });
    state.general.push({ id: 50, name: "D", minMark: 41, maxMark: 49, point: 1, divisionId: DIV });

    const defaults = await service.listGeneralGrades(MADRASA_ID);
    expect(defaults).toHaveLength(3);
    expect(defaults.every((g) => g.division_id === null)).toBe(true);

    const own = await service.listGeneralGrades(MADRASA_ID, "7");
    expect(own).toHaveLength(1);
    expect(own[0].division_id).toBe(DIV);

    expect(await service.listMadrasaGrades(MADRASA_ID, "7")).toEqual([]);
    await expect(service.listGeneralGrades(MADRASA_ID, "abc")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("effective fail mark: override, global fallback, class -> division", async () => {
    const { service } = makeService({ divisionFailMark: 40 });
    expect(await service.getEffectiveFailMark(MADRASA_ID, "7")).toBe(40);
    expect(await service.getEffectiveFailMark(MADRASA_ID, "8")).toBe(35);
    expect(await service.getEffectiveFailMark(MADRASA_ID, undefined, "3")).toBe(40);
  });

  it("division listing shape", async () => {
    const { service, state } = makeService({ divisionFailMark: 40 });
    state.general.push({ id: 50, name: "D", minMark: 41, maxMark: 49, point: 1, divisionId: DIV });
    expect(await service.listDivisionFailMarks(MADRASA_ID)).toEqual({
      global: 35,
      divisions: [
        { division_id: 7, name: "Hifz-bn", fail_mark: 40, has_custom_grades: true },
        { division_id: 8, name: "Kitab", fail_mark: null, has_custom_grades: false },
      ],
    });
  });
});

describe("fail grades are not bands (F / রাসিব)", () => {
  const legacyFail = (id: number, name: string, divisionId: number | null): Grade => ({
    id,
    name,
    minMark: 0,
    maxMark: 34,
    point: null,
    divisionId,
  });

  it("rejects creating or renaming a grade to the fail label", async () => {
    const { service, repository } = makeService();
    const dto = { min_mark: 0, max_mark: 34 };

    await expect(service.saveGeneralGrade(MADRASA_ID, { ...dto, name: "F" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.saveGeneralGrade(MADRASA_ID, { ...dto, name: " f " })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.updateGeneralGrade(3, MADRASA_ID, { ...dto, name: "F" })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.saveMadrasaGrade(MADRASA_ID, { ...dto, name: "রাসিব" })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("রাসিব স্বয়ংক্রিয় ফেল গ্রেড"),
    });
    await expect(service.updateMadrasaGrade(12, MADRASA_ID, { ...dto, name: "রাসিব" })).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(repository.createGeneralGrade).not.toHaveBeenCalled();
    expect(repository.createMadrasaGrade).not.toHaveBeenCalled();
    expect(repository.updateGeneralGrade).not.toHaveBeenCalled();
    expect(repository.updateMadrasaGrade).not.toHaveBeenCalled();
  });

  it("only the matching kind is reserved (রাসিব is fine as a general name, F as a madrasa name)", async () => {
    const { service, repository } = makeService();
    const dto = { min_mark: 10, max_mark: 20 };
    await service.saveGeneralGrade(MADRASA_ID, { ...dto, name: "রাসিব" });
    await service.saveMadrasaGrade(MADRASA_ID, { ...dto, name: "F" });
    expect(repository.createGeneralGrade).toHaveBeenCalledTimes(1);
    expect(repository.createMadrasaGrade).toHaveBeenCalledTimes(1);
  });

  it("repin skips a legacy fail row and pins the lowest passing band", async () => {
    const { service, state } = makeService();
    state.general.push(legacyFail(90, "F", null));
    state.madrasa.push(legacyFail(91, "রাসিব", null));

    await service.updateFailMark(MADRASA_ID, { value: 40 });

    expect(state.general.find((g) => g.id === 3)).toMatchObject({ minMark: 40, maxMark: 49 }); // D
    expect(state.general.find((g) => g.id === 90)).toMatchObject({ minMark: 0, maxMark: 34 }); // untouched
    expect(state.madrasa.find((g) => g.id === 12)?.minMark).toBe(40);
    expect(state.madrasa.find((g) => g.id === 91)).toMatchObject({ minMark: 0, maxMark: 34 });
  });

  it("does not clone legacy fail rows into a division", async () => {
    const { service, state } = makeService();
    state.general.push(legacyFail(90, "F", null));
    state.madrasa.push(legacyFail(91, "রাসিব", null));

    await service.updateDivisionFailMark(MADRASA_ID, DIV, { value: 40 });

    expect(state.general.filter((g) => g.divisionId === DIV).map((g) => g.name).sort()).toEqual(["A+", "B", "D"]);
    expect(state.madrasa.filter((g) => g.divisionId === DIV).map((g) => g.name).sort()).toEqual(
      ["Maqbul", "Mumtaz"].sort(),
    );
  });
});
