import { describe, expect, it, vi } from "vitest";
import { PromotionService } from "../promotion.service";
import { PromotionExecuteRequestDto } from "../promotion.dto";

function setup() {
  const students = [1, 2, 3].map((id) => ({
    id,
    madrasaId: 1,
    nameBn: `Student ${id}`,
    classId: 10,
    divisionId: 1,
    academicYear: "2026",
    sessionId: 100,
    roll: id,
    registrationNo: id,
    isActive: 1,
    deletedAt: null,
    admissionStatus: "APPROVED",
  }));
  const roster = [{ id: 99, classId: 20, academicYear: "2027", roll: 5 }];
  const classes = [10, 20].map((id) => ({
    id,
    divisionId: id === 10 ? 1 : 2,
    nameBn: `Class ${id}`,
    madrasaClasses: [],
  }));
  const tx: any = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (): Promise<{ number: number }[]> => []),
    class: { findMany: vi.fn(async () => classes) },
    session: {
      findFirst: vi.fn(async ({ where }: any) => ({ id: where.divisionId === 1 ? 101 : 201 })),
    },
    student: {
      findMany: vi.fn(async ({ where, select }: any) => {
        if (select?.registrationNo) return students;
        if (where.id)
          return students.filter(
            (student) =>
              where.id.in.includes(student.id) &&
              student.classId === where.classId &&
              student.academicYear === where.academicYear,
          );
        return [...students, ...roster].filter(
          (student) =>
            student.classId === where.classId && student.academicYear === where.academicYear,
        );
      }),
      update: vi.fn(async () => ({})),
    },
    madrasaClass: {
      findFirst: vi.fn(async () => ({
        id: 7,
        regNoStart: 51,
        regNoEnd: 100,
        regNoLastIssued: null,
      })),
      update: vi.fn(async () => ({})),
    },
  };
  const repository: any = {
    runTransaction: (fn: any) => fn(tx),
    lockRegistrationScopeOnTx: vi.fn(async () => {}),
    createBatchOnTx: vi.fn(async () => ({ id: 7 })),
    createRecordOnTx: vi.fn(async () => ({})),
  };
  const dto: PromotionExecuteRequestDto = {
    from_class_id: 10,
    to_class_id: 20,
    from_year: "2026",
    to_year: "2027",
    decisions: [{ student_id: 2, status: "PROMOTED" }],
  };
  return { service: new PromotionService(repository), repository, tx, dto, students, roster };
}

describe("selected student promotion and destination preview", () => {
  it("does not automatically reuse a roll from permanently deleted destination students", async () => {
    const { service, dto, tx } = setup();
    tx.$queryRaw.mockResolvedValue([{ number: 8 }]);
    const preview = await service.targetPreview(1, dto);
    expect(preview.rows[0].roll).toBe(9);
  });
  it("previews one selected student without writing or reserving numbers", async () => {
    const { service, dto, tx, repository } = setup();
    const preview = await service.targetPreview(1, dto);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      student_id: 2,
      old_roll: 2,
      roll: 6,
      registration_no: 51,
      class_id: 20,
      session_id: 201,
    });
    expect(tx.student.update).not.toHaveBeenCalled();
    expect(tx.madrasaClass.update).not.toHaveBeenCalled();
    expect(repository.createBatchOnTx).not.toHaveBeenCalled();
  });

  it("executes only selected students with exactly the previewed values", async () => {
    const { service, dto, tx, repository } = setup();
    const preview = await service.targetPreview(1, dto);
    const result = await service.execute(1, 9, { ...dto, preview_token: preview.preview_token });
    expect(result).toMatchObject({ promoted: 1, retained: 0, transferred: 0 });
    expect(tx.student.update).toHaveBeenCalledTimes(1);
    expect(tx.student.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        classId: 20,
        divisionId: 2,
        academicYear: "2027",
        sessionId: 201,
        roll: 6,
        registrationNo: 51,
        previousClassId: 10,
      },
    });
    expect(repository.createRecordOnTx).toHaveBeenCalledTimes(1);
  });

  it("handles several mixed decisions, retaining in the source division and leaving transfers unchanged", async () => {
    const { service, dto, tx } = setup();
    dto.decisions = [
      { student_id: 1, status: "PROMOTED" },
      { student_id: 2, status: "RETAINED" },
      { student_id: 3, status: "TRANSFERRED" },
    ];
    const preview = await service.targetPreview(1, dto);
    expect(preview.rows.map((row) => row.student_id)).toEqual([1, 2, 3]);
    expect(preview.rows[1]).toMatchObject({
      class_id: 10,
      roll: 2,
      registration_no: 2,
      session_id: 101,
    });
    expect(preview.rows[2]).toMatchObject({
      class_id: 10,
      roll: 3,
      academic_year: "2026",
      session_id: 100,
    });
    await expect(
      service.execute(1, 9, { ...dto, preview_token: preview.preview_token }),
    ).resolves.toMatchObject({ promoted: 1, retained: 1, transferred: 1 });
    expect(tx.student.update.mock.calls.map(([args]: any) => args.where.id)).toEqual([1, 2]);
  });

  it("allocates unique rolls and registration numbers for multiple promotions", async () => {
    const { service, dto } = setup();
    dto.decisions = [1, 2, 3].map((student_id) => ({ student_id, status: "PROMOTED" }));
    const preview = await service.targetPreview(1, dto);
    expect(preview.rows.map((row) => row.roll)).toEqual([6, 7, 8]);
    expect(preview.rows.map((row) => row.registration_no)).toEqual([51, 52, 53]);
  });

  it("resolves an occupied retained roll without overwriting the existing student", async () => {
    const { service, dto, roster } = setup();
    roster.push({ id: 98, classId: 10, academicYear: "2027", roll: 2 });
    dto.decisions = [{ student_id: 2, status: "RETAINED" }];
    const preview = await service.targetPreview(1, dto);
    expect(preview.rows[0]).toMatchObject({ old_roll: 2, roll: 3, class_id: 10 });
  });

  it("rejects a stale destination preview before saving any changes", async () => {
    const { service, dto, tx, repository, roster } = setup();
    const preview = await service.targetPreview(1, dto);
    roster.push({ id: 98, classId: 20, academicYear: "2027", roll: 6 });
    await expect(
      service.execute(1, 9, { ...dto, preview_token: preview.preview_token }),
    ).rejects.toThrow();
    expect(tx.student.update).not.toHaveBeenCalled();
    expect(repository.createBatchOnTx).not.toHaveBeenCalled();
  });

  it("preserves other retained students' free rolls when resolving a collision", async () => {
    const { service, dto, roster } = setup();
    roster.push({ id: 98, classId: 10, academicYear: "2027", roll: 2 });
    dto.decisions = [
      { student_id: 2, status: "RETAINED" },
      { student_id: 3, status: "RETAINED" },
    ];
    const preview = await service.targetPreview(1, dto);
    expect(preview.rows.map((row) => row.roll)).toEqual([4, 3]);
  });

  it("rejects students outside the selected source and duplicate decisions", async () => {
    const { service, dto } = setup();
    await expect(
      service.targetPreview(1, { ...dto, decisions: [{ student_id: 999, status: "PROMOTED" }] }),
    ).rejects.toThrow();
    await expect(
      service.targetPreview(1, { ...dto, decisions: [...dto.decisions, ...dto.decisions] }),
    ).rejects.toThrow();
  });

  it("rejects classes outside the tenant and missing destination sessions", async () => {
    const { service, dto, tx } = setup();
    tx.class.findMany.mockResolvedValueOnce([]);
    await expect(service.targetPreview(1, dto)).rejects.toThrow();
    tx.session.findFirst.mockResolvedValue(null);
    await expect(service.targetPreview(1, dto)).rejects.toThrow();
  });
});
