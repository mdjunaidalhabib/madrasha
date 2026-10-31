import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../routine.repository", () => ({ routineRepository: {}, RoutineRepository: class {} }));
vi.mock("../../exam-candidate/exam-candidate.hooks", () => ({ autoRegisterForRoutine: vi.fn() }));
vi.mock("../../ExamPanel/exam.hooks", () => ({ autoActivateExamForRoutine: vi.fn() }));
vi.mock("../../ExamPanel/exam-scope", () => ({ assertExamCoversClass: vi.fn() }));

import { RoutineService } from "../routine.service";
import type { RoutineRepository } from "../routine.repository";

const repository = { createClassRoutine: vi.fn(), createClassRoutinePeriods: vi.fn() };
const service = new RoutineService(repository as unknown as RoutineRepository);
const period = { class_id: 10, subject: "Arabic", start_time: "08:00", end_time: "08:40" };

beforeEach(() => vi.clearAllMocks());

describe("class timetable periods", () => {
  it("saves the same subject and time for all teaching days in one atomic write", async () => {
    await service.createClassRoutine(7, { ...period, days_of_week: [6, 0, 1, 2, 3, 4, 6] });
    expect(repository.createClassRoutine).not.toHaveBeenCalled();
    expect(repository.createClassRoutinePeriods).toHaveBeenCalledTimes(1);
    expect(repository.createClassRoutinePeriods).toHaveBeenCalledWith([6, 0, 1, 2, 3, 4].map((dayOfWeek) => ({
      madrasaId: 7, classId: 10, subject: "Arabic", startTime: "08:00", endTime: "08:40", teacherId: null, dayOfWeek,
    })));
  });

  it("preserves existing single-day requests", async () => {
    await service.createClassRoutine(7, { ...period, day_of_week: "0", teacher_id: 12 });
    expect(repository.createClassRoutine).toHaveBeenCalledWith(7, expect.objectContaining({ dayOfWeek: 0, teacherId: 12 }));
    expect(repository.createClassRoutinePeriods).not.toHaveBeenCalled();
  });

  it.each([[], [7], [-1], [1.5], [""], ["Monday"]])("rejects invalid day selection %j before saving", async (...days) => {
    await expect(service.createClassRoutine(7, { ...period, days_of_week: days as (number | string)[] })).rejects.toThrow();
    expect(repository.createClassRoutine).not.toHaveBeenCalled();
    expect(repository.createClassRoutinePeriods).not.toHaveBeenCalled();
  });

  it("rejects reversed period times for the whole week", async () => {
    await expect(service.createClassRoutine(7, { ...period, start_time: "10:00", days_of_week: [6, 0] })).rejects.toThrow();
    expect(repository.createClassRoutinePeriods).not.toHaveBeenCalled();
  });
});
