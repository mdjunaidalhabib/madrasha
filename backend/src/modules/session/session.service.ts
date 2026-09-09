import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { sessionRepository, SessionRepository } from "./session.repository";
import { CreateSessionRequestDto, UpdateSessionRequestDto } from "./session.dto";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const parseDate = (value: unknown, label: string): Date => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestError(`${label} is invalid`);
  return date;
};

export class SessionService {
  constructor(private readonly repository: SessionRepository = sessionRepository) {}

  async list(madrasaId: number, activeOnly = false, divisionId?: number | null) {
    try {
      return await this.repository.findSessions(madrasaId, activeOnly, divisionId);
    } catch (err) {
      return friendlyFailure("listSessions error:", err, "Failed to load sessions");
    }
  }

  async create(madrasaId: number, dto: CreateSessionRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.start_date) || isEmpty(dto.end_date)) {
      throw new BadRequestError("name, start_date and end_date are required");
    }
    const startDate = parseDate(dto.start_date, "start_date");
    const endDate = parseDate(dto.end_date, "end_date");
    if (startDate >= endDate) throw new BadRequestError("start_date must be before end_date");

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
        throw new ConflictError("A session with this name already exists");
      }
      return friendlyFailure("createSession error:", err, "Failed to create session");
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
      throw new BadRequestError("start_date must be before end_date");
    }
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateSession(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Session not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError("A session with this name already exists");
      }
      return friendlyFailure("updateSession error:", err, "Failed to update session");
    }
  }

  /** Transactionally makes this the one-and-only current session for its
   * division (see Session.isActive - "active" now means "current"). */
  async setCurrent(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError("Session not found");

    try {
      await this.repository.runTransaction(async (tx) => {
        await this.repository.unsetCurrentOnTx(tx, madrasaId, session.divisionId);
        await this.repository.setCurrentOnTx(tx, id);
      });
    } catch (err) {
      return friendlyFailure("setCurrentSession error:", err, "Failed to set current session");
    }
  }

  async delete(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError("সেশন পাওয়া যায়নি");

    const { activeStudentCount, rejectedStudentCount, trashedStudentCount, feeStructureCount, invoicedFeeStructureCount } =
      await this.repository.countReferencingRows(id, madrasaId);
    if (activeStudentCount > 0) {
      throw new BadRequestError(
        `এই সেশনে এখনও ${activeStudentCount} জন ছাত্র যুক্ত আছে — মুছে ফেলার আগে তাদের অন্য সেশনে সরিয়ে নিন`,
      );
    }
    // রিজেক্টেড ভর্তির আবেদন কোনো তালিকায়ই দেখা যায় না (ছাত্র তালিকা শুধু
    // APPROVED দেখায়, পেন্ডিং-আবেদন পেজ শুধু PENDING) - তাই "সরিয়ে নিন" বলার
    // বদলে "বাতিল হওয়া আবেদন" পেজে (দেখুন RejectedAdmissionsPage) পাঠানো হয়,
    // যেখান থেকে পুনরায় অনুমোদন বা স্থায়ীভাবে মুছে ফেলা যায়।
    if (rejectedStudentCount > 0) {
      throw new BadRequestError(
        `এই সেশনে ${rejectedStudentCount}টি বাতিল হওয়া ভর্তির আবেদন যুক্ত আছে — এগুলো কোনো তালিকায় দেখা যায় না, সেশন মুছে ফেলার আগে এগুলো মুছে ফেলুন`,
      );
    }
    // ছাত্র তালিকায় দেখা না গেলেও (ট্র্যাশে থাকা অবস্থায়) sessionId এখনও এই
    // সেশনকে পয়েন্ট করে (onDelete: Restrict), তাই স্থায়ীভাবে না মুছলে/
    // পুনরুদ্ধার না করলে সেশন ডিলিট আটকে যায় - অ্যাডমিনকে সেটা স্পষ্ট করে বলা হচ্ছে।
    if (trashedStudentCount > 0) {
      throw new BadRequestError(
        `এই সেশনের ${trashedStudentCount} জন ছাত্র ট্র্যাশে আছে — সেশন মুছে ফেলার আগে ট্র্যাশ থেকে তাদের স্থায়ীভাবে মুছে ফেলুন অথবা পুনরুদ্ধার করে অন্য সেশনে সরিয়ে নিন`,
      );
    }
    if (invoicedFeeStructureCount > 0) {
      // ইনভয়েস/পেমেন্ট রেকর্ড থাকা ফি কাঠামো কখনও bulk-delete করা হয় না -
      // হিসাবের ইতিহাস সুরক্ষিত রাখতে এখানে কোনো "মুছে ফেলুন" অপশন নেই।
      throw new BadRequestError(
        `এই সেশনে ${feeStructureCount}টি ফি কাঠামোর মধ্যে ${invoicedFeeStructureCount}টিতে প্রকৃত ইনভয়েস/পেমেন্ট রেকর্ড আছে — হিসাবের তথ্য সুরক্ষার জন্য এই সেশনটি মুছে ফেলা যাবে না`,
      );
    }
    if (feeStructureCount > 0) {
      throw new BadRequestError(
        `এই সেশনে ${feeStructureCount}টি ফি কাঠামো যুক্ত আছে (কোনো ইনভয়েস তৈরি হয়নি) — সেশন মুছে ফেলার আগে এগুলো মুছে ফেলুন`,
      );
    }

    try {
      const result = await this.repository.deleteSession(id, madrasaId);
      if (!result.count) throw new NotFoundError("সেশন পাওয়া যায়নি");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteSession error:", err, "সেশন মুছতে সমস্যা হয়েছে");
    }
  }

  /** One-click cleanup for the "fee structures block this session's delete"
   * case surfaced by `delete()` above - only ever offered to the client
   * when invoicedFeeStructureCount is 0, and the repository query itself
   * re-checks that (see SessionRepository.deleteUnusedFeeStructuresForSession). */
  async deleteUnusedFeeStructures(id: number, madrasaId: number) {
    const session = await this.repository.findSessionForTenant(id, madrasaId);
    if (!session) throw new NotFoundError("সেশন পাওয়া যায়নি");

    const result = await this.repository.deleteUnusedFeeStructuresForSession(id, madrasaId);
    return result.count;
  }
}

export const sessionService = new SessionService();
