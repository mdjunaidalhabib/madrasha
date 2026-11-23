import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { closingTemplateSchema, paperSchema, type PaperInput } from "./question-paper.schema";

type TemplateKind = "closing" | "instruction";

export class QuestionPaperService {
  constructor(private readonly db = prisma) {}

  async listClosingTemplates(madrasaId: number, kind: TemplateKind = "closing") {
    const defaults =
      kind === "instruction"
        ? [
            {
              builtinKey: "answer-all",
              text: t({ bn: "সকল প্রশ্নের উত্তর দাও।", en: "Answer all questions." }),
            },
            {
              builtinKey: "marks",
              text: t({
                bn: "প্রশ্নের ডান পাশে পূর্ণমান দেওয়া আছে।",
                en: "Marks are shown beside each question.",
              }),
            },
            {
              builtinKey: "clear-writing",
              text: t({
                bn: "উত্তর স্পষ্ট ও পরিচ্ছন্নভাবে লিখবে।",
                en: "Write your answers clearly and neatly.",
              }),
            },
          ]
        : [
            {
              builtinKey: "handwriting",
              text: t({
                bn: "সুন্দর হাতের লেখার জন্য ৫ নম্বর।",
                en: "5 marks for neat handwriting.",
              }),
            },
            {
              builtinKey: "spelling",
              text: t({
                bn: "প্রতি ২টি বানান ভুলের জন্য ১ নম্বর কাটা যাবে।",
                en: "1 mark will be deducted for every 2 spelling mistakes.",
              }),
            },
            {
              builtinKey: "next-page",
              text: t({
                bn: "বাকি প্রশ্ন অপর পৃষ্ঠায়।",
                en: "Remaining questions are on the next page.",
              }),
            },
            {
              builtinKey: "ending",
              text: t({ bn: "প্রশ্নপত্রের সমাপ্তি", en: "End of question paper" }),
            },
          ];
    // Assign stable keys to matching templates created before defaults were editable.
    const existing = await this.db.questionPaperClosingTemplate.findMany({
      where: { madrasaId, kind },
    });
    for (const entry of defaults) {
      if (!existing.some((item) => item.builtinKey === entry.builtinKey)) {
        await this.db.questionPaperClosingTemplate.updateMany({
          where: { madrasaId, kind, text: entry.text, builtinKey: null },
          data: { builtinKey: entry.builtinKey },
        });
      }
    }
    await this.db.questionPaperClosingTemplate.createMany({
      data: defaults.map((entry) => ({ madrasaId, kind, ...entry })),
      skipDuplicates: true,
    });
    return this.db.questionPaperClosingTemplate.findMany({
      where: { madrasaId, kind, deletedAt: null },
      select: { id: true, text: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  async createClosingTemplate(madrasaId: number, body: unknown, kind: TemplateKind = "closing") {
    const { text } = closingTemplateSchema.parse(body);
    return this.db.questionPaperClosingTemplate.upsert({
      where: { madrasaId_kind_text: { madrasaId, kind, text } },
      create: { madrasaId, kind, text },
      update: { deletedAt: null },
      select: { id: true, text: true },
    });
  }

  async updateClosingTemplate(
    madrasaId: number,
    id: string,
    body: unknown,
    kind: TemplateKind = "closing",
  ) {
    const { text } = closingTemplateSchema.parse(body);
    try {
      const result = await this.db.questionPaperClosingTemplate.updateMany({
        where: { id, madrasaId, kind, deletedAt: null },
        data: { text },
      });
      if (!result.count) throw new NotFoundError();
      return { id, text };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError(
          t({
            bn: "এই লেখার টেমপ্লেট আগে থেকেই আছে।",
            en: "A template with this text already exists.",
          }),
        );
      }
      throw error;
    }
  }

  async removeClosingTemplate(madrasaId: number, id: string, kind: TemplateKind = "closing") {
    const result = await this.db.questionPaperClosingTemplate.updateMany({
      where: { id, madrasaId, kind, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundError();
  }

  async references(madrasaId: number) {
    const [divisions, classes, subjects, branding, exams] = await Promise.all([
      this.db.madrasaDivision.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        include: { division: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.db.madrasaClass.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        include: { class: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.db.madrasaBook.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        include: { book: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.db.madrasa.findUniqueOrThrow({
        where: { id: madrasaId },
        select: { name: true, address: true },
      }),
      this.db.exam.findMany({
        where: { madrasaId, isActive: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          year: true,
          startDate: true,
          endDate: true,
          divisions: { select: { divisionId: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
    ]);
    return {
      branding,
      exams: exams.map(({ divisions, ...exam }) => ({
        ...exam,
        divisionIds: divisions.map((d) => d.divisionId),
      })),
      divisions: divisions.map((r) => ({
        id: r.divisionId,
        name: r.nameBn || r.division.nameBn || r.division.name || "",
      })),
      classes: classes.map((r) => ({
        id: r.classId,
        divisionId: r.class.divisionId,
        name: r.nameBn || r.class.nameBn || r.class.name || "",
      })),
      subjects: subjects.map((r) => ({
        id: r.bookId,
        classId: r.book.classId,
        name: r.book.nameBn || r.book.name || "",
      })),
    };
  }

  async list(madrasaId: number) {
    const rows = await this.db.questionPaper.findMany({
      where: { madrasaId },
      orderBy: { updatedAt: "desc" },
      include: { madrasa: { select: { name: true, address: true } } },
    });
    return rows.map(({ madrasa, ...p }) => ({
      ...p,
      institution: madrasa.name,
      address: madrasa.address || "",
    }));
  }

  private async data(madrasaId: number, input: PaperInput) {
    const refs = await this.references(madrasaId);
    const division = refs.divisions.find((d) => d.id === input.divisionId);
    const cls = refs.classes.find(
      (c) => c.id === input.classId && c.divisionId === input.divisionId,
    );
    const subject = refs.subjects.find(
      (s) => s.id === input.subjectId && s.classId === input.classId,
    );
    if (!division || !cls || !subject)
      throw new BadRequestError(
        t({
          bn: "নির্বাচিত বিভাগ, শ্রেণি ও বিষয় সঠিক নয় বা সক্রিয় নেই।",
          en: "Select an active division, class and subject belonging to this institution.",
        }),
      );
    return {
      title: input.title,
      divisionId: input.divisionId,
      classId: input.classId,
      subjectId: input.subjectId,
      divisionName: division.name,
      className: cls.name,
      subject: subject.name,
      duration: input.duration,
      instructions: input.instructions,
      ...(input.layout ? { layout: input.layout } : {}),
      questions: input.questions as Prisma.InputJsonValue,
    };
  }

  async create(madrasaId: number, createdBy: number | undefined, body: unknown) {
    const input = paperSchema.parse(body);
    const data = await this.data(madrasaId, input);
    const row = await this.db.questionPaper.create({
      data: { ...data, madrasaId, createdBy },
      include: { madrasa: { select: { name: true, address: true } } },
    });
    const { madrasa, ...paper } = row;
    return { ...paper, institution: madrasa.name, address: madrasa.address || "" };
  }

  async update(madrasaId: number, id: string, body: unknown) {
    const input = paperSchema.parse(body);
    const existing = await this.db.questionPaper.findFirst({ where: { id, madrasaId } });
    if (!existing) throw new NotFoundError();
    if (!input.updatedAt) throw new BadRequestError("updatedAt is required");
    const data = await this.data(madrasaId, input);
    return this.db.$transaction(async (tx) => {
      const result = await tx.questionPaper.updateMany({
        where: { id, madrasaId, updatedAt: new Date(input.updatedAt!) },
        data,
      });
      if (!result.count)
        throw new ConflictError(
          t({
            bn: "প্রশ্নপত্রটি অন্য জায়গা থেকে বদলেছে। তালিকা রিফ্রেশ করে আবার খুলুন।",
            en: "This paper changed elsewhere. Refresh the list and reopen it.",
          }),
        );
      const row = await tx.questionPaper.findFirstOrThrow({
        where: { id, madrasaId },
        include: { madrasa: { select: { name: true, address: true } } },
      });
      const { madrasa, ...paper } = row;
      return { ...paper, institution: madrasa.name, address: madrasa.address || "" };
    });
  }

  async remove(madrasaId: number, id: string) {
    const result = await this.db.questionPaper.deleteMany({ where: { id, madrasaId } });
    if (!result.count) throw new NotFoundError();
  }
}
export const questionPaperService = new QuestionPaperService();
