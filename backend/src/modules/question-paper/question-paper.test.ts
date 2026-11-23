import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

vi.mock("../../shared/database/prisma", () => ({ prisma: {} }));
import { QuestionPaperService } from "./question-paper.service";
import { paperSchema } from "./question-paper.schema";

const question = () => ({
  id: randomUUID(),
  type: "written",
  text: "Explain the water cycle",
  marks: 5,
  options: ["", "", "", ""],
  answer: "Teacher answer",
});
const input = () => ({
  title: "First term",
  divisionId: 11,
  classId: 21,
  subjectId: 31,
  duration: "2 hours",
  instructions: "Answer all questions",
  questions: [question()],
});

function setup() {
  const db = {
    questionPaperClosingTemplate: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    madrasaDivision: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { divisionId: 11, nameBn: "Local division", division: { nameBn: "Catalogue division" } },
        ]),
    },
    madrasaClass: {
      findMany: vi.fn().mockResolvedValue([
        {
          classId: 21,
          nameBn: "Local class",
          class: { divisionId: 11, nameBn: "Catalogue class" },
        },
      ]),
    },
    madrasaBook: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ bookId: 31, book: { classId: 21, nameBn: "Science" } }]),
    },
    madrasa: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Academy", address: "Dhaka" }),
    },
    exam: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "First term",
          year: "2026",
          startDate: null,
          endDate: null,
          divisions: [{ divisionId: 11 }],
        },
      ]),
    },
    questionPaper: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn) => fn(db));
  const service = new QuestionPaperService(db as never);
  return { db, service };
}

describe("Question paper service", () => {
  beforeEach(() => vi.clearAllMocks());
  it("lists closing templates only for the authenticated tenant", async () => {
    const { db, service } = setup();
    db.questionPaperClosingTemplate.findMany.mockResolvedValue([
      { id: "template", text: "Write clearly." },
    ]);
    await expect(service.listClosingTemplates(4)).resolves.toEqual([
      { id: "template", text: "Write clearly." },
    ]);
    expect(db.questionPaperClosingTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { madrasaId: 4, kind: "closing", deletedAt: null } }),
    );
  });
  it("creates reusable templates without duplicate tenant entries or trusting a client tenant", async () => {
    const { db, service } = setup();
    db.questionPaperClosingTemplate.upsert.mockResolvedValue({
      id: "template",
      text: "Write clearly.",
    });
    await service.createClosingTemplate(4, { text: "  Write clearly.  ", madrasaId: 999 });
    expect(db.questionPaperClosingTemplate.upsert).toHaveBeenCalledWith({
      where: { madrasaId_kind_text: { madrasaId: 4, kind: "closing", text: "Write clearly." } },
      create: { madrasaId: 4, kind: "closing", text: "Write clearly." },
      update: { deletedAt: null },
      select: { id: true, text: true },
    });
  });
  it("keeps edited and deleted defaults tied to their original keys", async () => {
    const { db, service } = setup();
    db.questionPaperClosingTemplate.findMany
      .mockResolvedValueOnce([
        { builtinKey: "handwriting", text: "Edited handwriting text" },
        { builtinKey: "spelling", text: "Deleted spelling text", deletedAt: new Date() },
        { builtinKey: "next-page", text: "Edited next-page text" },
        { builtinKey: "ending", text: "Deleted ending text", deletedAt: new Date() },
      ])
      .mockResolvedValueOnce([]);
    await service.listClosingTemplates(4);
    expect(db.questionPaperClosingTemplate.updateMany).not.toHaveBeenCalled();
    expect(db.questionPaperClosingTemplate.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ madrasaId: 4, builtinKey: "handwriting" }),
        expect.objectContaining({ madrasaId: 4, builtinKey: "spelling" }),
        expect.objectContaining({ madrasaId: 4, builtinKey: "next-page" }),
        expect.objectContaining({ madrasaId: 4, builtinKey: "ending" }),
      ]),
      skipDuplicates: true,
    });
  });
  it("keeps instruction templates separate from closing templates in every operation", async () => {
    const { db, service } = setup();
    db.questionPaperClosingTemplate.findMany.mockResolvedValue([]);
    db.questionPaperClosingTemplate.upsert.mockResolvedValue({
      id: "instruction",
      text: "Answer all questions.",
    });
    await service.listClosingTemplates(4, "instruction");
    expect(db.questionPaperClosingTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { madrasaId: 4, kind: "instruction", deletedAt: null } }),
    );
    expect(db.questionPaperClosingTemplate.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ madrasaId: 4, kind: "instruction", builtinKey: "answer-all" }),
      ]),
      skipDuplicates: true,
    });
    await service.createClosingTemplate(4, { text: "Answer all questions." }, "instruction");
    expect(db.questionPaperClosingTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          madrasaId_kind_text: { madrasaId: 4, kind: "instruction", text: "Answer all questions." },
        },
        create: { madrasaId: 4, kind: "instruction", text: "Answer all questions." },
      }),
    );
    await service.updateClosingTemplate(
      4,
      "instruction",
      { text: "Read carefully." },
      "instruction",
    );
    await service.removeClosingTemplate(4, "instruction", "instruction");
    expect(db.questionPaperClosingTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "instruction", madrasaId: 4, kind: "instruction", deletedAt: null },
        data: { text: "Read carefully." },
      }),
    );
    expect(db.questionPaperClosingTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "instruction", madrasaId: 4, kind: "instruction", deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });
  it("rejects empty, oversized and multiline template text", async () => {
    const { db, service } = setup();
    for (const text of ["  ", "x".repeat(501), "First\nSecond"]) {
      await expect(service.createClosingTemplate(4, { text })).rejects.toThrow();
    }
    expect(db.questionPaperClosingTemplate.upsert).not.toHaveBeenCalled();
  });
  it("updates template text inside the authenticated tenant only", async () => {
    const { db, service } = setup();
    await expect(
      service.updateClosingTemplate(4, "template", { text: " Revised text. ", madrasaId: 99 }),
    ).resolves.toEqual({ id: "template", text: "Revised text." });
    expect(db.questionPaperClosingTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: "template", madrasaId: 4, kind: "closing", deletedAt: null },
      data: { text: "Revised text." },
    });
    expect(db.questionPaper.updateMany).not.toHaveBeenCalled();
  });
  it("hides deleted templates without changing saved question papers", async () => {
    const { db, service } = setup();
    await service.removeClosingTemplate(4, "template");
    expect(db.questionPaperClosingTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: "template", madrasaId: 4, kind: "closing", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(db.questionPaper.updateMany).not.toHaveBeenCalled();
  });
  it("rejects unknown or other-tenant templates and duplicate text", async () => {
    const { db, service } = setup();
    db.questionPaperClosingTemplate.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updateClosingTemplate(5, "other-tenant", { text: "New" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.removeClosingTemplate(5, "other-tenant")).rejects.toMatchObject({
      statusCode: 404,
    });
    db.questionPaperClosingTemplate.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Duplicate", { code: "P2002", clientVersion: "6" }),
    );
    await expect(
      service.updateClosingTemplate(4, "template", { text: "Duplicate" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("returns active tenant references and tenant-specific names", async () => {
    const { db, service } = setup();
    const refs = await service.references(4);
    expect(refs.branding).toEqual({ name: "Academy", address: "Dhaka" });
    expect(refs.classes[0]).toEqual({ id: 21, divisionId: 11, name: "Local class" });
    expect(refs.exams[0]).toEqual({
      id: 1,
      name: "First term",
      year: "2026",
      startDate: null,
      endDate: null,
      divisionIds: [11],
    });
    expect(db.exam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { madrasaId: 4, isActive: true, deletedAt: null },
      }),
    );
    for (const model of [db.madrasaDivision, db.madrasaClass, db.madrasaBook])
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { madrasaId: 4, isActive: 1, deletedAt: null } }),
      );
  });
  it("ignores client branding and binds new papers to the authenticated tenant", async () => {
    const { db, service } = setup();
    db.questionPaper.create.mockResolvedValue({
      id: "saved",
      madrasa: { name: "Academy", address: "Dhaka" },
    });
    const result = await service.create(4, 8, {
      ...input(),
      madrasaId: 999,
      institution: "Spoofed",
      subject: "Spoofed",
    });
    expect(db.questionPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          madrasaId: 4,
          createdBy: 8,
          className: "Local class",
          subject: "Science",
        }),
      }),
    );
    expect(result.institution).toBe("Academy");
    expect(result.address).toBe("Dhaka");
  });
  it("rejects a class outside the selected division", async () => {
    const { db, service } = setup();
    await expect(service.create(4, 8, { ...input(), divisionId: 99 })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(db.questionPaper.create).not.toHaveBeenCalled();
  });
  it("saves layout controls and question bold formatting", async () => {
    const { db, service } = setup();
    const layout = {
      headerLineStyle: "double" as const,
      headerLineThickness: 2,
      footerText: "Finished",
      questionSpacing: 24,
      instructionsBold: true,
      footerBold: true,
    };
    db.questionPaper.create.mockResolvedValue({
      layout,
      madrasa: { name: "Academy", address: "Dhaka" },
    });
    await service.create(4, 8, { ...input(), layout, questions: [{ ...question(), bold: true }] });
    expect(db.questionPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layout,
          questions: [expect.objectContaining({ bold: true })],
        }),
      }),
    );
  });
  it("rejects a subject outside the selected class", async () => {
    const { db, service } = setup();
    db.madrasaBook.findMany.mockResolvedValue([
      { bookId: 31, book: { classId: 99, nameBn: "Science" } },
    ]);
    await expect(service.create(4, 8, input())).rejects.toMatchObject({ statusCode: 400 });
    expect(db.questionPaper.create).not.toHaveBeenCalled();
  });
  it("does not update papers from a different tenant", async () => {
    const { db, service } = setup();
    db.questionPaper.findFirst.mockResolvedValue(null);
    const id = randomUUID();
    await expect(service.update(5, id, input())).rejects.toMatchObject({ statusCode: 404 });
    expect(db.questionPaper.findFirst).toHaveBeenCalledWith({ where: { id, madrasaId: 5 } });
    expect(db.questionPaper.updateMany).not.toHaveBeenCalled();
  });
  it("checks the saved version before updating and rejects stale writes", async () => {
    const { db, service } = setup();
    db.questionPaper.findFirst.mockResolvedValue({ id: "saved" });
    db.questionPaper.updateMany.mockResolvedValue({ count: 0 });
    const updatedAt = new Date().toISOString();
    await expect(service.update(4, "saved", { ...input(), updatedAt })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.questionPaper.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "saved", madrasaId: 4, updatedAt: new Date(updatedAt) },
      }),
    );
  });
  it("only lists and deletes papers in the requested tenant", async () => {
    const { db, service } = setup();
    db.questionPaper.findMany.mockResolvedValue([]);
    await service.list(4);
    expect(db.questionPaper.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { madrasaId: 4 } }),
    );
    db.questionPaper.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(5, "other-paper")).rejects.toMatchObject({ statusCode: 404 });
    expect(db.questionPaper.deleteMany).toHaveBeenCalledWith({
      where: { id: "other-paper", madrasaId: 5 },
    });
  });
});

describe("Question validation", () => {
  it("rejects invalid layout settings", () => {
    const layout = {
      footerText: "Done",
      questionSpacing: 10,
      instructionsBold: false,
      footerBold: false,
    };
    for (const questionSpacing of [-1, 61, 1.5]) {
      expect(
        paperSchema.safeParse({ ...input(), layout: { ...layout, questionSpacing } }).success,
      ).toBe(false);
    }
    expect(
      paperSchema.safeParse({ ...input(), layout: { ...layout, footerText: "x".repeat(501) } })
        .success,
    ).toBe(false);
  });
  it("rejects incomplete MCQs, invalid marks and duplicate question IDs", () => {
    const p = input();
    expect(
      paperSchema.safeParse({ ...p, questions: [{ ...question(), type: "mcq" }] }).success,
    ).toBe(false);
    expect(paperSchema.safeParse({ ...p, questions: [{ ...question(), marks: -1 }] }).success).toBe(
      false,
    );
    expect(
      paperSchema.safeParse({ ...p, questions: [p.questions[0], p.questions[0]] }).success,
    ).toBe(false);
  });
  it("accepts complete MCQs and half marks", () => {
    expect(
      paperSchema.safeParse({
        ...input(),
        questions: [
          { ...question(), type: "mcq", marks: 0.5, options: ["A", "B", "C", "D"], answer: "2" },
        ],
      }).success,
    ).toBe(true);
  });
});
