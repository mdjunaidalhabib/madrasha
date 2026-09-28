import { BadRequestError, NotFoundError } from "../../shared/errors";
import { noticeRepository, NoticeRepository } from "./notice.repository";
import { CreateNoticeRequestDto, UpdateNoticeRequestDto } from "./notice.dto";
import { t } from "../../shared/i18n";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const MAX_TITLE_LENGTH = 190;

export class NoticeService {
  constructor(private readonly repository: NoticeRepository = noticeRepository) {}

  async list(madrasaId: number) {
    return this.repository.findMany(madrasaId);
  }

  async create(madrasaId: number, createdBy: number | undefined, dto: CreateNoticeRequestDto) {
    if (isEmpty(dto.title) || isEmpty(dto.body)) {
      throw new BadRequestError(t({ bn: "শিরোনাম ও বিবরণ আবশ্যক", en: "title and body are required", ar: "العنوان والمحتوى مطلوبان" }));
    }
    const title = String(dto.title).trim();
    if (title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestError(t({ bn: `শিরোনাম সর্বোচ্চ ${MAX_TITLE_LENGTH} অক্ষরের হতে পারে`, en: `title must be at most ${MAX_TITLE_LENGTH} characters`, ar: `يجب ألا يتجاوز العنوان ${MAX_TITLE_LENGTH} حرفًا` }));
    }

    return this.repository.create(madrasaId, {
      title,
      body: String(dto.body),
      createdBy: createdBy ?? null,
    });
  }

  async update(id: number, madrasaId: number, dto: UpdateNoticeRequestDto) {
    const existing = await this.repository.findById(id, madrasaId);
    if (!existing) throw new NotFoundError(t({ bn: "নোটিশ পাওয়া যায়নি", en: "Notice not found", ar: "لم يتم العثور على الإشعار" }));

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (isEmpty(dto.title)) throw new BadRequestError(t({ bn: "শিরোনাম খালি রাখা যাবে না", en: "title cannot be empty", ar: "لا يمكن أن يكون العنوان فارغًا" }));
      const title = String(dto.title).trim();
      if (title.length > MAX_TITLE_LENGTH) {
        throw new BadRequestError(t({ bn: `শিরোনাম সর্বোচ্চ ${MAX_TITLE_LENGTH} অক্ষরের হতে পারে`, en: `title must be at most ${MAX_TITLE_LENGTH} characters`, ar: `يجب ألا يتجاوز العنوان ${MAX_TITLE_LENGTH} حرفًا` }));
      }
      data.title = title;
    }
    if (dto.body !== undefined) {
      if (isEmpty(dto.body)) throw new BadRequestError(t({ bn: "বিবরণ খালি রাখা যাবে না", en: "body cannot be empty", ar: "لا يمكن أن يكون المحتوى فارغًا" }));
      data.body = String(dto.body);
    }

    if (!Object.keys(data).length) throw new BadRequestError(t({ bn: "আপডেট করার মতো কোনো সঠিক তথ্য নেই", en: "No valid data to update", ar: "لا توجد بيانات صالحة للتحديث" }));

    await this.repository.update(id, madrasaId, data);
  }

  async delete(id: number, madrasaId: number) {
    const result = await this.repository.delete(id, madrasaId);
    if (!result.count) throw new NotFoundError(t({ bn: "নোটিশ পাওয়া যায়নি", en: "Notice not found", ar: "لم يتم العثور على الإشعار" }));
  }
}

export const noticeService = new NoticeService();
