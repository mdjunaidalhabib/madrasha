import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";

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
    madrasaDivision: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { divisionId: 11, nameBn: "Local division", division: { nameBn: "Catalogue division" } },
        ]),
    },
    madrasaClass: {
      findMany: vi
        .fn()
        .mockResolvedValue([
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
  it("returns active tenant references and tenant-specific names", async () => {
    const { db, service } = setup();
    const refs = await service.references(4);
    expect(refs.branding).toEqual({ name: "Academy", address: "Dhaka" });
    expect(refs.classes[0]).toEqual({ id: 21, divisionId: 11, name: "Local class" });
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
