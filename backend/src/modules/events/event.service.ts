import { BadRequestError, NotFoundError } from "../../shared/errors";
import { eventRepository, EventRepository } from "./event.repository";
import { CreateEventRequestDto, UpdateEventRequestDto } from "./event.dto";
import { EVENT_TYPES, TIME_FORMAT_REGEX } from "./event.constants";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const validateType = (type: unknown) => {
  const value = String(type || "OTHER").toUpperCase();
  if (!EVENT_TYPES.includes(value as any)) {
    throw new BadRequestError(`type must be one of: ${EVENT_TYPES.join(", ")}`);
  }
  return value;
};

const validateOptionalTime = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") return null;
  if (!TIME_FORMAT_REGEX.test(String(value))) {
    throw new BadRequestError(`${field} must be in HH:mm 24-hour format`);
  }
  return String(value);
};

export class EventService {
  constructor(private readonly repository: EventRepository = eventRepository) {}

  async list(madrasaId: number) {
    return this.repository.findMany(madrasaId);
  }

  async create(madrasaId: number, dto: CreateEventRequestDto) {
    if (isEmpty(dto.title) || isEmpty(dto.event_date)) {
      throw new BadRequestError("title and event_date are required");
    }

    const eventDate = new Date(dto.event_date);
    if (Number.isNaN(eventDate.getTime())) throw new BadRequestError("event_date is invalid");

    return this.repository.create(madrasaId, {
      title: String(dto.title).trim(),
      type: validateType(dto.type) as any,
      eventDate,
      startTime: validateOptionalTime(dto.start_time, "start_time"),
      endTime: validateOptionalTime(dto.end_time, "end_time"),
      description: dto.description?.trim() || null,
    });
  }

  async update(id: number, madrasaId: number, dto: UpdateEventRequestDto) {
    const existing = await this.repository.findById(id, madrasaId);
    if (!existing) throw new NotFoundError("ইভেন্ট পাওয়া যায়নি");

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (isEmpty(dto.title)) throw new BadRequestError("title cannot be empty");
      data.title = String(dto.title).trim();
    }
    if (dto.type !== undefined) data.type = validateType(dto.type);
    if (dto.event_date !== undefined) {
      const eventDate = new Date(dto.event_date);
      if (Number.isNaN(eventDate.getTime())) throw new BadRequestError("event_date is invalid");
      data.eventDate = eventDate;
    }
    if (dto.start_time !== undefined) data.startTime = validateOptionalTime(dto.start_time, "start_time");
    if (dto.end_time !== undefined) data.endTime = validateOptionalTime(dto.end_time, "end_time");
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    await this.repository.update(id, madrasaId, data);
  }

  async delete(id: number, madrasaId: number) {
    const result = await this.repository.delete(id, madrasaId);
    if (!result.count) throw new NotFoundError("ইভেন্ট পাওয়া যায়নি");
  }
}

export const eventService = new EventService();
