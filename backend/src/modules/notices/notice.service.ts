import { BadRequestError, NotFoundError } from "../../shared/errors";
import { noticeRepository, NoticeRepository } from "./notice.repository";
import { CreateNoticeRequestDto, UpdateNoticeRequestDto } from "./notice.dto";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const MAX_TITLE_LENGTH = 190;

export class NoticeService {
  constructor(private readonly repository: NoticeRepository = noticeRepository) {}

  async list(madrasaId: number) {
    return this.repository.findMany(madrasaId);
  }

  async create(madrasaId: number, createdBy: number | undefined, dto: CreateNoticeRequestDto) {
    if (isEmpty(dto.title) || isEmpty(dto.body)) {
      throw new BadRequestError("title and body are required");
    }
    const title = String(dto.title).trim();
    if (title.length > MAX_TITLE_LENGTH) {
      throw new BadRequestError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }

    return this.repository.create(madrasaId, {
      title,
      body: String(dto.body),
      createdBy: createdBy ?? null,
    });
  }

  async update(id: number, madrasaId: number, dto: UpdateNoticeRequestDto) {
    const existing = await this.repository.findById(id, madrasaId);
    if (!existing) throw new NotFoundError("নোটিশ পাওয়া যায়নি");

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (isEmpty(dto.title)) throw new BadRequestError("title cannot be empty");
      const title = String(dto.title).trim();
      if (title.length > MAX_TITLE_LENGTH) {
        throw new BadRequestError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
      }
      data.title = title;
    }
    if (dto.body !== undefined) {
      if (isEmpty(dto.body)) throw new BadRequestError("body cannot be empty");
      data.body = String(dto.body);
    }

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    await this.repository.update(id, madrasaId, data);
  }

  async delete(id: number, madrasaId: number) {
    const result = await this.repository.delete(id, madrasaId);
    if (!result.count) throw new NotFoundError("নোটিশ পাওয়া যায়নি");
  }
}

export const noticeService = new NoticeService();
