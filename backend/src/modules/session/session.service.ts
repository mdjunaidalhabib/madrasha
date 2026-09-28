import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { sessionRepository, SessionRepository } from "./session.repository";
import { CreateSessionRequestDto, UpdateSessionRequestDto } from "./session.dto";
import { t } from "../../shared/i18n";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const parseDate = (value: unknown, label: string): Date => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestError(t({ bn: `${label} সঠিক নয়`, en: `${label} is invalid`, ar: `${label} غير صالح` }));
  return date;
};

export class SessionService {
  constructor(private readonly repository: SessionRepository = sessionRepository) {}

  async list(madrasaId: number, activeOnly = false, divisionId?: number | null) {
    try {
      return await this.repository.findSessions(madrasaId, activeOnly, divisionId);
    } catch (err) {
      return friendlyFailure("listSessions error:", err, t({ bn: "সেশন লোড করা যায়নি", en: "Failed to load sessions", ar: "تعذر تحميل الأعوام الدراسية" }));
    }
  }

  async create(madrasaId: number, dto: CreateSessionRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.start_date) || isEmpty(dto.end_date)) {
      throw new BadRequestError(t({ bn: "নাম, start_date ও end_date আবশ্যক", en: "name, start_date and end_date are required", ar: "الاسم وتاريخ البداية وتاريخ النهاية مطلوبة" }));
    }
    const startDate = parseDate(dto.start_date, "start_date");
    const endDate = parseDate(dto.end_date, "end_date");
    if (startDate >= endDate) throw new BadRequestError(t({ bn: "শুরুর তারিখ অবশ্যই শেষের তারিখের আগে হতে হবে", en: "start_date must be before end_date", ar: "يجب أن يكون تاريخ البداية قبل تاريخ النهاية" }));

    const divisionId =
      dto.division_id === undefined || dto.division_id === null || dto.division_id === ""
        ? null
        : Number(dto.division_id);

    try {
      return await this.repository.runTransaction(async (tx) => {
        const session = await tx.session.create({
          data: {
            madrasaId,
            divisionId,
            name: String(dto.name).trim(),
            startDate,
            endDate,
          },
        });
        if (dto.is_active) {
          await this.repository.unsetCurrentOnTx(tx, madrasaId, divisionId);
          return this.repository.setCurrentOnTx(tx, session.id);
        }
        return session;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(t({ bn: "এই নামে একটি সেশন ইতিমধ্যে আছে", en: "A session with this name already exists", ar: "يوجد عام دراسي بهذا الاسم بالفعل" }));
      }
      return friendlyFailure("createSession error:", err, t({ bn: "সেশন তৈরি করা যায়নি", en: "Failed to create session", ar: "تعذر إنشاء العام الدراسي" }));
    }
  }

  async update(id: number, madrasaId: number, dto: UpdateSessionRequestDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.start_date !== undefined) data.startDate = parseDate(dto.start_date, "start_date");
    if (dto.end_date !== undefined) data.endDate = parseDate(dto.end_date, "end_date");
    if (dto.division_id !== undefined) {
      data.divisionId = dto.division_id === null || dto.division_id === "" ? null : Number(dto.division_id);
    }

    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new BadRequestError(t({ bn: "শুরুর তারিখ অবশ্যই শেষের তারিখের আগে হতে হবে", en: "start_date must be before end_date", ar: "يجب أن يكون تاريخ البداية قبل تاريخ النهاية" }));
    }
    if (!Object.keys(data).length) throw new BadRequestError(t({ bn: "আপডেট করার মতো কোনো সঠিক তথ্য নেই", en: "No valid data to update", ar: "لا توجد بيانات صالحة للتحديث" }));

    try {
      const result = await this.repository.updateSession(id, madrasaId, data);
      if (!result.count) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found", ar: "لم يتم العثور على الجلسة" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(t({ bn: "এই নামে একটি সেশন ইতিমধ্যে আছে", en: "A session with this name already exists", ar: "يوجد عام دراسي بهذا الاسم بالفعل" }));
      }
      return friendlyFailure("updateSession error:", err, t({ bn: "সেশন আপডেট করা যায়নি", en: "Failed to update session", ar: "تعذر تحديث العام الدراسي" }));
    }
  }

  /** Transactionally makes this the one-and-only current session for its
   * division (see Session.isActive - "active" now means "current"). */
  async setCurrent(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found", ar: "لم يتم العثور على الجلسة" }));

    try {
      await this.repository.runTransaction(async (tx) => {
        await this.repository.unsetCurrentOnTx(tx, madrasaId, session.divisionId);
        await this.repository.setCurrentOnTx(tx, id);
      });
    } catch (err) {
      return friendlyFailure("setCurrentSession error:", err, t({ bn: "চলতি সেশন নির্ধারণ করা যায়নি", en: "Failed to set current session", ar: "تعذر تعيين العام الدراسي الحالي" }));
    }
  }

  async delete(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found", ar: "لم يتم العثور على العام الدراسي" }));

    const { activeStudentCount, rejectedStudentCount, trashedStudentCount, feeStructureCount, invoicedFeeStructureCount } =
      await this.repository.countReferencingRows(id, madrasaId);
    if (activeStudentCount > 0) {
      throw new BadRequestError(
        t({ bn: `এই সেশনে এখনও ${activeStudentCount} জন শিক্ষার্থী যুক্ত আছে — মুছে ফেলার আগে তাদের অন্য সেশনে সরিয়ে নিন`, en: `${activeStudentCount} student(s) are still in this session — move them to another session before deleting it`, ar: `لا يزال ${activeStudentCount} طالب مرتبطين بهذا العام الدراسي — انقلهم إلى عام آخر قبل الحذف` }),
      );
    }
    // রিজেক্টেড ভর্তির আবেদন কোনো তালিকায়ই দেখা যায় না (ছাত্র তালিকা শুধু
    // APPROVED দেখায়, পেন্ডিং-আবেদন পেজ শুধু PENDING) - তাই "সরিয়ে নিন" বলার
    // বদলে "বাতিল হওয়া আবেদন" পেজে (দেখুন RejectedAdmissionsPage) পাঠানো হয়,
    // যেখান থেকে পুনরায় অনুমোদন বা স্থায়ীভাবে মুছে ফেলা যায়।
    if (rejectedStudentCount > 0) {
      throw new BadRequestError(
        t({ bn: `এই সেশনে ${rejectedStudentCount}টি বাতিল হওয়া ভর্তির আবেদন যুক্ত আছে — এগুলো কোনো তালিকায় দেখা যায় না, সেশন মুছে ফেলার আগে এগুলো মুছে ফেলুন`, en: `${rejectedStudentCount} rejected admission application(s) are linked to this session — they don't appear in any list; delete them before deleting the session`, ar: `يرتبط بهذا العام الدراسي ${rejectedStudentCount} طلب قبول مرفوض — لا تظهر في أي قائمة؛ احذفها قبل حذف العام الدراسي` }),
      );
    }
    // ছাত্র তালিকায় দেখা না গেলেও (ট্র্যাশে থাকা অবস্থায়) sessionId এখনও এই
    // সেশনকে পয়েন্ট করে (onDelete: Restrict), তাই স্থায়ীভাবে না মুছলে/
    // পুনরুদ্ধার না করলে সেশন ডিলিট আটকে যায় - অ্যাডমিনকে সেটা স্পষ্ট করে বলা হচ্ছে।
    if (trashedStudentCount > 0) {
      throw new BadRequestError(
        t({ bn: `এই সেশনের ${trashedStudentCount} জন শিক্ষার্থী ট্র্যাশে আছে — সেশন মুছে ফেলার আগে ট্র্যাশ থেকে তাদের স্থায়ীভাবে মুছে ফেলুন অথবা পুনরুদ্ধার করে অন্য সেশনে সরিয়ে নিন`, en: `${trashedStudentCount} student(s) of this session are in the trash — permanently delete them from the trash, or restore and move them to another session, before deleting the session`, ar: `يوجد ${trashedStudentCount} طالب من هذا العام الدراسي في سلة المهملات — احذفهم نهائيًا أو استعدهم وانقلهم إلى عام آخر قبل حذف العام الدراسي` }),
      );
    }
    if (invoicedFeeStructureCount > 0) {
      // ইনভয়েস/পেমেন্ট রেকর্ড থাকা ফি কাঠামো কখনও bulk-delete করা হয় না -
      // হিসাবের ইতিহাস সুরক্ষিত রাখতে এখানে কোনো "মুছে ফেলুন" অপশন নেই।
      throw new BadRequestError(
        t({ bn: `এই সেশনে ${feeStructureCount}টি ফি কাঠামোর মধ্যে ${invoicedFeeStructureCount}টিতে প্রকৃত ইনভয়েস/পেমেন্ট রেকর্ড আছে — হিসাবের তথ্য সুরক্ষার জন্য এই সেশনটি মুছে ফেলা যাবে না`, en: `${invoicedFeeStructureCount} of the ${feeStructureCount} fee structures in this session have real invoice/payment records — this session cannot be deleted to protect accounting data`, ar: `${invoicedFeeStructureCount} من أصل ${feeStructureCount} هياكل رسوم في هذا العام الدراسي لها سجلات فواتير/مدفوعات فعلية — لا يمكن حذف هذا العام الدراسي حفاظًا على البيانات المحاسبية` }),
      );
    }
    if (feeStructureCount > 0) {
      throw new BadRequestError(
        t({ bn: `এই সেশনে ${feeStructureCount}টি ফি কাঠামো যুক্ত আছে (কোনো ইনভয়েস তৈরি হয়নি) — সেশন মুছে ফেলার আগে এগুলো মুছে ফেলুন`, en: `${feeStructureCount} fee structure(s) are linked to this session (no invoices created) — delete them before deleting the session`, ar: `يرتبط بهذا العام الدراسي ${feeStructureCount} هيكل رسوم (لم تُنشأ فواتير) — احذفها قبل حذف العام الدراسي` }),
      );
    }

    try {
      const result = await this.repository.deleteSession(id, madrasaId);
      if (!result.count) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found", ar: "لم يتم العثور على العام الدراسي" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteSession error:", err, t({ bn: "সেশন মুছতে সমস্যা হয়েছে", en: "Failed to delete the session", ar: "تعذر حذف العام الدراسي" }));
    }
  }

  /** One-click cleanup for the "fee structures block this session's delete"
   * case surfaced by `delete()` above - only ever offered to the client
   * when invoicedFeeStructureCount is 0, and the repository query itself
   * re-checks that (see SessionRepository.deleteUnusedFeeStructuresForSession). */
  async deleteUnusedFeeStructures(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found", ar: "لم يتم العثور على العام الدراسي" }));

    const result = await this.repository.deleteUnusedFeeStructuresForSession(id, madrasaId);
    return result.count;
  }
}

export const sessionService = new SessionService();
