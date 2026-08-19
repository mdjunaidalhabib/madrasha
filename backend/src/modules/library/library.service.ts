import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { libraryRepository, LibraryRepository } from "./library.repository";
import { studentRepository } from "../students/student.repository";
import { teacherRepository } from "../teacher/teacher.repository";
import {
  BookQueryDto,
  BorrowRecordQueryDto,
  CreateBookRequestDto,
  CreateCategoryRequestDto,
  IssueBookRequestDto,
  ReturnBookRequestDto,
  UpdateBookRequestDto,
  UpdateCategoryRequestDto,
  UpdateFinePerDayRequestDto,
} from "./library.dto";
import { DEFAULT_BORROW_DAYS, DEFAULT_FINE_PER_DAY } from "./library.constants";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const toPositiveInt = (value: unknown, label: string, fallback?: number): number => {
  if (isEmpty(value)) {
    if (fallback !== undefined) return fallback;
    throw new BadRequestError(`${label} must be a positive whole number`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError(`${label} must be a positive whole number`);
  return n;
};

const toNonNegativeNumber = (value: unknown, label: string): number => {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) throw new BadRequestError(`${label} must be a non-negative number`);
  return n;
};

/** Whole calendar days between `dueDate` and `asOf`, floored at 0 - never
 * negative (a book returned/checked before its due date is never "late"). */
const daysLate = (dueDate: Date, asOf: Date): number => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diff = Math.floor((asOf.getTime() - dueDate.getTime()) / MS_PER_DAY);
  return Math.max(0, diff);
};

export class LibraryService {
  constructor(private readonly repository: LibraryRepository = libraryRepository) {}

  /* ================= CATEGORIES ================= */

  async listCategories(madrasaId: number) {
    try {
      return await this.repository.findCategories(madrasaId);
    } catch (err) {
      return friendlyFailure("listCategories error:", err, "Failed to load categories");
    }
  }

  async createCategory(madrasaId: number, dto: CreateCategoryRequestDto) {
    if (isEmpty(dto.name)) throw new BadRequestError("name is required");
    try {
      await this.repository.createCategory(madrasaId, { name: dto.name.trim() });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestError("A category with this name already exists");
      }
      return friendlyFailure("createCategory error:", err, "Failed to create category");
    }
  }

  async updateCategory(id: number, madrasaId: number, dto: UpdateCategoryRequestDto) {
    if (dto.name !== undefined && isEmpty(dto.name)) throw new BadRequestError("name cannot be empty");
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateCategory(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Category not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestError("A category with this name already exists");
      }
      return friendlyFailure("updateCategory error:", err, "Failed to update category");
    }
  }

  async deleteCategory(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteCategory(id, madrasaId);
      if (!result.count) throw new NotFoundError("Category not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteCategory error:", err, "Failed to delete category");
    }
  }

  /* ================= BOOKS ================= */

  async listBooks(madrasaId: number, query: BookQueryDto) {
    const where: Prisma.LibraryBookWhereInput = { isActive: true };
    if (query.category_id) where.categoryId = Number(query.category_id);
    if (query.available_only === "true") where.copiesAvailable = { gt: 0 };
    if (!isEmpty(query.q)) {
      const q = String(query.q).trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } },
        { isbn: { contains: q, mode: "insensitive" } },
      ];
    }

    try {
      return await this.repository.findBooks(madrasaId, where);
    } catch (err) {
      return friendlyFailure("listBooks error:", err, "Failed to load books");
    }
  }

  async getBook(id: number, madrasaId: number) {
    const book = await this.repository.findBookForTenant(id, madrasaId);
    if (!book) throw new NotFoundError("Book not found");
    return book;
  }

  async createBook(madrasaId: number, dto: CreateBookRequestDto) {
    if (isEmpty(dto.title)) throw new BadRequestError("title is required");
    const copiesTotal = toPositiveInt(dto.copies_total, "copies_total", 1);

    if (dto.category_id) {
      const category = await this.repository.findCategoryForTenant(Number(dto.category_id), madrasaId);
      if (!category) throw new BadRequestError("Selected category not found");
    }

    try {
      await this.repository.createBook(madrasaId, {
        title: dto.title.trim(),
        author: dto.author?.trim() || null,
        isbn: dto.isbn?.trim() || null,
        publisher: dto.publisher?.trim() || null,
        categoryId: dto.category_id ? Number(dto.category_id) : null,
        shelfLocation: dto.shelf_location?.trim() || null,
        copiesTotal,
        copiesAvailable: copiesTotal,
      });
    } catch (err) {
      return friendlyFailure("createBook error:", err, "Failed to create book");
    }
  }

  async updateBook(id: number, madrasaId: number, dto: UpdateBookRequestDto) {
    const existing = await this.repository.findBookForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError("Book not found");

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (isEmpty(dto.title)) throw new BadRequestError("title cannot be empty");
      data.title = dto.title.trim();
    }
    if (dto.author !== undefined) data.author = dto.author?.trim() || null;
    if (dto.isbn !== undefined) data.isbn = dto.isbn?.trim() || null;
    if (dto.publisher !== undefined) data.publisher = dto.publisher?.trim() || null;
    if (dto.shelf_location !== undefined) data.shelfLocation = dto.shelf_location?.trim() || null;
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);
    if (dto.category_id !== undefined) {
      if (dto.category_id) {
        const category = await this.repository.findCategoryForTenant(Number(dto.category_id), madrasaId);
        if (!category) throw new BadRequestError("Selected category not found");
        data.categoryId = Number(dto.category_id);
      } else {
        data.categoryId = null;
      }
    }
    if (dto.copies_total !== undefined) {
      const newTotal = toPositiveInt(dto.copies_total, "copies_total");
      const delta = newTotal - existing.copiesTotal;
      const newAvailable = existing.copiesAvailable + delta;
      if (newAvailable < 0) {
        throw new BadRequestError(
          `copies_total can't be reduced below the number currently on loan (${existing.copiesTotal - existing.copiesAvailable} on loan)`,
        );
      }
      data.copiesTotal = newTotal;
      data.copiesAvailable = newAvailable;
    }
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateBook(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Book not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateBook error:", err, "Failed to update book");
    }
  }

  /** Blocks hard-delete once a book has any loan history (even fully
   * returned) - deactivate via is_active=false instead. */
  async deleteBook(id: number, madrasaId: number) {
    const existing = await this.repository.findBookForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError("Book not found");

    const activeBorrows = await this.repository.countActiveBorrowsForBook(id, madrasaId);
    if (activeBorrows > 0) {
      throw new BadRequestError(
        "This book has loan history and can't be deleted - deactivate it instead (is_active=false)",
      );
    }

    try {
      const result = await this.repository.deleteBook(id, madrasaId);
      if (!result.count) throw new NotFoundError("Book not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteBook error:", err, "Failed to delete book");
    }
  }

  /* ================= CIRCULATION ================= */

  private async resolveBorrower(madrasaId: number, dto: { student_id?: number | string; teacher_id?: number | string }) {
    const hasStudent = !isEmpty(dto.student_id);
    const hasTeacher = !isEmpty(dto.teacher_id);
    if (hasStudent === hasTeacher) {
      throw new BadRequestError("Provide exactly one of student_id or teacher_id");
    }

    if (hasStudent) {
      const student = await studentRepository.findByIdForTenant(Number(dto.student_id), madrasaId);
      if (!student) throw new BadRequestError("Selected student not found");
      return { studentId: student.id, teacherId: null as number | null };
    }

    const teacher = await teacherRepository.findFirstForTenant(Number(dto.teacher_id), madrasaId);
    if (!teacher) throw new BadRequestError("Selected teacher not found");
    return { studentId: null as number | null, teacherId: teacher.id };
  }

  async issueBook(madrasaId: number, issuedById: number | undefined, dto: IssueBookRequestDto) {
    if (isEmpty(dto.book_id)) throw new BadRequestError("book_id is required");
    const bookId = Number(dto.book_id);

    const borrower = await this.resolveBorrower(madrasaId, dto);

    let dueDate: Date;
    if (!isEmpty(dto.due_date)) {
      dueDate = new Date(String(dto.due_date));
      if (Number.isNaN(dueDate.getTime())) throw new BadRequestError("due_date is invalid");
    } else {
      dueDate = new Date(Date.now() + DEFAULT_BORROW_DAYS * 24 * 60 * 60 * 1000);
    }

    try {
      return await this.repository.runTransaction(async (tx) => {
        const book = await this.repository.findBookForTenantOnTx(tx, bookId, madrasaId);
        if (!book) throw new NotFoundError("Book not found");
        if (!book.isActive) throw new BadRequestError("This book is inactive");
        if (book.copiesAvailable <= 0) throw new BadRequestError("No copies of this book are currently available");

        await this.repository.decrementBookCopiesOnTx(tx, bookId);

        const record = await this.repository.createBorrowRecordOnTx(tx, {
          madrasaId,
          bookId,
          studentId: borrower.studentId,
          teacherId: borrower.teacherId,
          dueDate,
          issuedById: issuedById ?? null,
          notes: dto.notes?.trim() || null,
        });

        return record;
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("issueBook error:", err, "Failed to issue book");
    }
  }

  async returnBook(id: number, madrasaId: number, returnedById: number | undefined, dto: ReturnBookRequestDto) {
    const ratePerDay = await this.getFinePerDay(madrasaId);

    try {
      return await this.repository.runTransaction(async (tx) => {
        const record = await this.repository.findBorrowRecordForTenantOnTx(tx, id, madrasaId);
        if (!record) throw new NotFoundError("Borrow record not found");
        if (record.status !== "BORROWED") throw new BadRequestError("This book has already been returned or marked lost");

        const now = new Date();
        const late = daysLate(record.dueDate, now);
        const fineAmount = late * ratePerDay;

        await this.repository.incrementBookCopiesOnTx(tx, record.bookId);

        const updated = await this.repository.updateBorrowRecordOnTx(tx, id, {
          status: "RETURNED",
          returnedAt: now,
          returnedById: returnedById ?? null,
          fineAmount,
          notes: dto.notes?.trim() || record.notes,
        });

        return { ...updated, daysLate: late };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("returnBook error:", err, "Failed to return book");
    }
  }

  /** Permanently removes this copy from inventory (copiesTotal decrements,
   * unlike a normal return, since the book itself is gone). */
  async markLost(id: number, madrasaId: number, notes?: string) {
    try {
      return await this.repository.runTransaction(async (tx) => {
        const record = await this.repository.findBorrowRecordForTenantOnTx(tx, id, madrasaId);
        if (!record) throw new NotFoundError("Borrow record not found");
        if (record.status !== "BORROWED") throw new BadRequestError("This borrow record is not currently active");

        await tx.libraryBook.update({
          where: { id: record.bookId },
          data: { copiesTotal: { decrement: 1 } },
        });

        return this.repository.updateBorrowRecordOnTx(tx, id, {
          status: "LOST",
          returnedAt: new Date(),
          notes: notes?.trim() || record.notes,
        });
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("markLost error:", err, "Failed to mark book as lost");
    }
  }

  async settleFine(id: number, madrasaId: number) {
    try {
      return await this.repository.runTransaction(async (tx) => {
        const record = await this.repository.findBorrowRecordForTenantOnTx(tx, id, madrasaId);
        if (!record) throw new NotFoundError("Borrow record not found");
        if (Number(record.fineAmount) <= 0) throw new BadRequestError("This record has no fine to settle");
        if (record.fineSettled) throw new BadRequestError("This fine is already settled");

        return this.repository.updateBorrowRecordOnTx(tx, id, {
          fineSettled: true,
          fineSettledAt: new Date(),
        });
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("settleFine error:", err, "Failed to settle fine");
    }
  }

  async listBorrowRecords(madrasaId: number, query: BorrowRecordQueryDto) {
    const where: Prisma.LibraryBorrowRecordWhereInput = {};
    if (query.status) where.status = query.status as any;
    if (query.student_id) where.studentId = Number(query.student_id);
    if (query.teacher_id) where.teacherId = Number(query.teacher_id);
    if (query.book_id) where.bookId = Number(query.book_id);
    if (query.overdue_only === "true") {
      where.status = "BORROWED";
      where.dueDate = { lt: new Date() };
    }
    if (query.unsettled_fine_only === "true") {
      where.status = "RETURNED";
      where.fineAmount = { gt: 0 };
      where.fineSettled = false;
    }

    try {
      const ratePerDay = await this.getFinePerDay(madrasaId);
      const records = await this.repository.findBorrowRecords(madrasaId, where);
      const now = new Date();
      return records.map((record) => this.decorateBorrowRecord(record, ratePerDay, now));
    } catch (err) {
      return friendlyFailure("listBorrowRecords error:", err, "Failed to load borrow records");
    }
  }

  /** Adds on-the-fly, never-persisted daysOverdue/estimatedFine to a
   * still-BORROWED record - the DB's fineAmount stays 0 until return. */
  private decorateBorrowRecord(record: Record<string, any>, ratePerDay: number, now: Date) {
    if (record.status !== "BORROWED") return { ...record, daysOverdue: 0, estimatedFine: 0 };
    const late = daysLate(record.dueDate, now);
    return { ...record, daysOverdue: late, estimatedFine: late * ratePerDay };
  }

  /* ================= SETTINGS ================= */

  async getFinePerDay(madrasaId: number): Promise<number> {
    try {
      const setting = await this.repository.findFinePerDaySetting(madrasaId);
      return Number(setting?.value ?? DEFAULT_FINE_PER_DAY);
    } catch (err) {
      return friendlyFailure("getFinePerDay error:", err, "Failed to load the fine rate");
    }
  }

  async setFinePerDay(madrasaId: number, dto: UpdateFinePerDayRequestDto) {
    const value = toNonNegativeNumber(dto.value, "value");
    try {
      await this.repository.upsertFinePerDaySetting(madrasaId, String(value));
    } catch (err) {
      return friendlyFailure("setFinePerDay error:", err, "Failed to update the fine rate");
    }
  }
}

export const libraryService = new LibraryService();
