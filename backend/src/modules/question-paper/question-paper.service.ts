import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { paperSchema, type PaperInput } from "./question-paper.schema";

export class QuestionPaperService {
  constructor(private readonly db = prisma) {}

  async references(madrasaId: number) {
    const [divisions, classes, subjects, branding] = await Promise.all([
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
    ]);
    return {
      branding,
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
