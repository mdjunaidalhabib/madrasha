import { MarkComponentType } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";

export interface SaveMarkComponentsRequestDto {
  book_id: number | string;
  exam_id?: number | string | null;
  components: { component: string; full_mark: number | string; sort_order?: number | string }[];
}

/**
 * Optional, additive per-subject mark-distribution breakdown (written / MCQ
 * / practical / oral / assignment / class assessment / other). A book with
 * no MarkComponentConfig rows behaves exactly as before in marks entry (a
 * single flat total) - see ResultPanelService.saveMarks.
 */
export class MarkComponentService {
  async getComponents(madrasaId: number, bookId: number, examId: number | null) {
    if (!bookId) throw new BadRequestError("book_id is required");

    const rows = await prisma.markComponentConfig.findMany({
      where: {
        madrasaId,
        bookId,
        OR: [...(examId ? [{ examId }] : []), { examId: null }],
      },
      orderBy: { sortOrder: "asc" },
    });

    // Prefer exam-specific rows over the book-wide fallback.
    const specific = examId ? rows.filter((r) => r.examId === examId) : [];
    const effective = specific.length ? specific : rows.filter((r) => r.examId === null);

    return {
      book_id: bookId,
      exam_id: examId ?? null,
      components: effective.map((r) => ({
        component: r.component,
        full_mark: r.fullMark,
        sort_order: r.sortOrder,
      })),
    };
  }

  async saveComponents(madrasaId: number, userId: number, body: SaveMarkComponentsRequestDto) {
    const bookId = Number(body.book_id);
    const examId =
      body.exam_id === undefined || body.exam_id === null || body.exam_id === ("" as any)
        ? null
        : Number(body.exam_id);
    const components = Array.isArray(body.components) ? body.components : [];

    if (!bookId) throw new BadRequestError("book_id is required");
    if (!components.length) {
      throw new BadRequestError("অন্তত একটি নম্বর বিভাজন উপাদান (component) দিতে হবে।");
    }

    const validTypes = new Set(Object.values(MarkComponentType) as string[]);
    let sum = 0;
    const rows = components.map((c, index) => {
      const component = String(c.component);
      if (!validTypes.has(component)) {
        throw new BadRequestError(`"${component}" একটি বৈধ নম্বর বিভাজন ধরন নয়।`);
      }
      const fullMark = Number(c.full_mark);
      if (!Number.isInteger(fullMark) || fullMark <= 0) {
        throw new BadRequestError(`"${component}" এর পূর্ণ নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।`);
      }
      sum += fullMark;
      const sortOrder = Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : index;
      return { madrasaId, bookId, examId, component: component as MarkComponentType, fullMark, sortOrder };
    });

    const madrasaBook = await prisma.madrasaBook.findFirst({ where: { madrasaId, bookId } });
    if (!madrasaBook) {
      throw new BadRequestError("এই বিষয়টি এই মাদরাসার জন্য খুঁজে পাওয়া যায়নি।");
    }
    if (sum !== madrasaBook.fullMark) {
      throw new BadRequestError(
        `মোট নম্বর ${sum} বিষয়ের পূর্ণ নম্বর ${madrasaBook.fullMark} এর সাথে মিলছে না।`,
      );
    }

    await prisma.$transaction([
      prisma.markComponentConfig.deleteMany({ where: { madrasaId, bookId, examId } }),
      prisma.markComponentConfig.createMany({ data: rows }),
    ]);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "UPDATE",
      entity: "results/mark-components",
      entity_id: bookId,
      details: JSON.stringify({
        book_id: bookId,
        exam_id: examId,
        components: rows.map((r) => ({ component: r.component, full_mark: r.fullMark })),
      }),
    });

    return { message: "নম্বর বিভাজন সংরক্ষণ করা হয়েছে", book_id: bookId, exam_id: examId };
  }
}

export const markComponentService = new MarkComponentService();
