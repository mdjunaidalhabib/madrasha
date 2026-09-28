import { MarkComponentType } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ConflictError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { t } from "../../shared/i18n";

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
    if (!bookId) throw new BadRequestError(t({ bn: "book_id আবশ্যক", en: "book_id is required", ar: "book_id مطلوب" }));

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

    if (!bookId) throw new BadRequestError(t({ bn: "book_id আবশ্যক", en: "book_id is required", ar: "book_id مطلوب" }));
    if (!components.length) {
      throw new BadRequestError(t({ bn: "অন্তত একটি নম্বর বিভাজন উপাদান (component) দিতে হবে।", en: "At least one mark component must be provided.", ar: "يجب تقديم مكوّن واحد على الأقل لتقسيم الدرجات." }));
    }

    const validTypes = new Set(Object.values(MarkComponentType) as string[]);
    let sum = 0;
    const rows = components.map((c, index) => {
      const component = String(c.component);
      if (!validTypes.has(component)) {
        throw new BadRequestError(t({ bn: `"${component}" একটি বৈধ নম্বর বিভাজন ধরন নয়।`, en: `"${component}" is not a valid mark component type.`, ar: `"${component}" ليس نوعًا صالحًا لتقسيم الدرجات.` }));
      }
      const fullMark = Number(c.full_mark);
      if (!Number.isInteger(fullMark) || fullMark <= 0) {
        throw new BadRequestError(t({ bn: `"${component}" এর পূর্ণ নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।`, en: `The full mark of "${component}" must be a positive integer.`, ar: `يجب أن تكون الدرجة الكاملة لـ "${component}" عددًا صحيحًا موجبًا.` }));
      }
      sum += fullMark;
      const sortOrder = Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : index;
      return { madrasaId, bookId, examId, component: component as MarkComponentType, fullMark, sortOrder };
    });

    const madrasaBook = await prisma.madrasaBook.findFirst({ where: { madrasaId, bookId } });
    if (!madrasaBook) {
      throw new BadRequestError(t({ bn: "এই বিষয়টি এই প্রতিষ্ঠানের জন্য খুঁজে পাওয়া যায়নি।", en: "This subject was not found for this institution.", ar: "لم يتم العثور على هذه المادة لهذه المؤسسة." }));
    }
    if (sum !== madrasaBook.fullMark) {
      throw new BadRequestError(
        t({ bn: `মোট নম্বর ${sum} বিষয়ের পূর্ণ নম্বর ${madrasaBook.fullMark} এর সাথে মিলছে না।`, en: `The total ${sum} does not match the subject's full mark ${madrasaBook.fullMark}.`, ar: `المجموع ${sum} لا يطابق الدرجة الكاملة للمادة ${madrasaBook.fullMark}.` }),
      );
    }

    // Changing a component's fullMark changes the effective denominator
    // saveMarks() uses to compute a mark from its component breakdown - if
    // this book already has marks entered for a PUBLISHED/LOCKED result
    // (scoped to this exam when exam-specific, or any exam when this is the
    // book-wide fallback config), that result's grading would silently
    // drift out from under it. Block the same way saveMarks blocks direct
    // edits to a published/locked session. Mark has no `resultMaster`
    // relation declared (only the resultMasterId scalar), so this is a
    // manual two-step lookup rather than a nested relation filter.
    const marksForBook = await prisma.mark.findMany({
      where: { madrasaId, bookId, ...(examId ? { examId } : {}) },
      select: { resultMasterId: true },
      distinct: ["resultMasterId"],
    });
    const affectedPublishedMark = marksForBook.length
      ? await prisma.resultMaster.findFirst({
          where: {
            id: { in: marksForBook.map((m) => m.resultMasterId) },
            status: { in: ["PUBLISHED", "LOCKED"] },
            deletedAt: null,
          },
          select: { id: true },
        })
      : null;
    if (affectedPublishedMark) {
      throw new ConflictError(
        t({ bn: "এই বিষয়ের নম্বর বিভাজন পরিবর্তন করা যাবে না — এটি ইতিমধ্যে প্রকাশিত/লক করা একটি ফলাফলে ব্যবহৃত হয়েছে। প্রয়োজনে 'ফলাফল সংশোধন' (correction) প্রক্রিয়া ব্যবহার করুন।", en: "This subject's mark components cannot be changed — they are already used in a published/locked result. Use the 'result correction' process if needed.", ar: "لا يمكن تغيير تقسيم درجات هذه المادة — فهو مستخدم بالفعل في نتيجة منشورة/مقفلة. استخدم إجراء 'تصحيح النتيجة' عند الحاجة." }),
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

    return { message: t({ bn: "নম্বর বিভাজন সংরক্ষণ করা হয়েছে", en: "Mark components saved", ar: "تم حفظ تقسيم الدرجات" }), book_id: bookId, exam_id: examId };
  }
}

export const markComponentService = new MarkComponentService();
