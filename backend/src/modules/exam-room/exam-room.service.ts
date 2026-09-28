import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { examRoomRepository, ExamRoomRepository } from "./exam-room.repository";
import { CreateExamRoomRequestDto, UpdateExamRoomRequestDto } from "./exam-room.dto";
import { t } from "../../shared/i18n";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const isDuplicateError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const parseCapacity = (value: unknown): number => {
  const capacity = value === undefined || value === null || value === "" ? 0 : Number(value);
  if (Number.isNaN(capacity) || capacity < 0) throw new BadRequestError(t({ bn: "capacity অবশ্যই ঋণাত্মক নয় এমন সংখ্যা হতে হবে", en: "capacity must be a non-negative number", ar: "يجب أن تكون السعة عددًا غير سالب" }));
  return capacity;
};

export class ExamRoomService {
  constructor(private readonly repository: ExamRoomRepository = examRoomRepository) {}

  async listRooms(madrasaId: number, activeOnly?: boolean) {
    try {
      return await this.repository.findRooms(madrasaId, activeOnly);
    } catch (err) {
      return friendlyFailure("listRooms error:", err, t({ bn: "পরীক্ষার কক্ষ লোড করা যায়নি", en: "Failed to load exam rooms", ar: "تعذر تحميل قاعات الامتحان" }));
    }
  }

  async createRoom(madrasaId: number, dto: CreateExamRoomRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.code)) {
      throw new BadRequestError(t({ bn: "নাম ও কোড আবশ্যক", en: "name and code are required", ar: "الاسم والرمز مطلوبان" }));
    }
    const capacity = parseCapacity(dto.capacity);

    try {
      await this.repository.createRoom(madrasaId, {
        name: String(dto.name).trim(),
        code: String(dto.code).trim(),
        capacity,
        floor: dto.floor?.trim() || null,
        location: dto.location?.trim() || null,
        notes: dto.notes?.trim() || null,
      });
    } catch (err) {
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই কোডের একটি কক্ষ ইতিমধ্যে আছে", en: "A room with this code already exists", ar: "توجد قاعة بهذا الرمز بالفعل" }));
      return friendlyFailure("createRoom error:", err, t({ bn: "পরীক্ষার কক্ষ তৈরি করা যায়নি", en: "Failed to create exam room", ar: "تعذر إنشاء قاعة الامتحان" }));
    }
  }

  async updateRoom(id: number, madrasaId: number, dto: UpdateExamRoomRequestDto) {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.code !== undefined) data.code = String(dto.code).trim();
    if (dto.capacity !== undefined) data.capacity = parseCapacity(dto.capacity);
    if (dto.floor !== undefined) data.floor = dto.floor?.trim() || null;
    if (dto.location !== undefined) data.location = dto.location?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);

    if (!Object.keys(data).length) throw new BadRequestError(t({ bn: "আপডেট করার মতো কোনো সঠিক তথ্য নেই", en: "No valid data to update", ar: "لا توجد بيانات صالحة للتحديث" }));

    try {
      const result = await this.repository.updateRoom(id, madrasaId, data);
      if (!result.count) throw new NotFoundError(t({ bn: "পরীক্ষার কক্ষ পাওয়া যায়নি", en: "Exam room not found", ar: "لم يتم العثور على قاعة الامتحان" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (isDuplicateError(err)) throw new ConflictError(t({ bn: "এই কোডের একটি কক্ষ ইতিমধ্যে আছে", en: "A room with this code already exists", ar: "توجد قاعة بهذا الرمز بالفعل" }));
      return friendlyFailure("updateRoom error:", err, t({ bn: "পরীক্ষার কক্ষ আপডেট করা যায়নি", en: "Failed to update exam room", ar: "تعذر تحديث قاعة الامتحان" }));
    }
  }

  async deactivateRoom(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deactivateRoom(id, madrasaId);
      if (!result.count) throw new NotFoundError(t({ bn: "পরীক্ষার কক্ষ পাওয়া যায়নি", en: "Exam room not found", ar: "لم يتم العثور على قاعة الامتحان" }));
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deactivateRoom error:", err, t({ bn: "পরীক্ষার কক্ষ নিষ্ক্রিয় করা যায়নি", en: "Failed to deactivate exam room", ar: "تعذر تعطيل قاعة الامتحان" }));
    }
  }
}

export const examRoomService = new ExamRoomService();
