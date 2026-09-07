import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";
import { LIBRARY_FINE_PER_DAY_SETTING_NAME } from "./library.constants";

export class LibraryRepository {
  /* ================= CATEGORIES ================= */

  findCategories(madrasaId: number) {
    return prisma.libraryBookCategory.findMany({
      where: { madrasaId },
      orderBy: { name: "asc" },
    });
  }

  findCategoryForTenant(id: number, madrasaId: number) {
    return prisma.libraryBookCategory.findFirst({ where: { id, madrasaId } });
  }

  createCategory(madrasaId: number, data: Record<string, unknown>) {
    return prisma.libraryBookCategory.create({ data: { ...data, madrasaId } as any });
  }

  updateCategory(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.libraryBookCategory.updateMany({ where: { id, madrasaId }, data });
  }

  deleteCategory(id: number, madrasaId: number) {
    return prisma.libraryBookCategory.deleteMany({ where: { id, madrasaId } });
  }

  /* ================= BOOKS ================= */

  findBooks(madrasaId: number, where: Prisma.LibraryBookWhereInput) {
    return prisma.libraryBook.findMany({
      where: { madrasaId, ...where },
      orderBy: { title: "asc" },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  findBookForTenant(id: number, madrasaId: number) {
    return prisma.libraryBook.findFirst({
      where: { id, madrasaId },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  createBook(madrasaId: number, data: Record<string, unknown>) {
    return prisma.libraryBook.create({ data: { ...data, madrasaId } as any });
  }

  updateBook(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.libraryBook.updateMany({ where: { id, madrasaId }, data });
  }

  deleteBook(id: number, madrasaId: number) {
    return prisma.libraryBook.deleteMany({ where: { id, madrasaId } });
  }

  /** Guards book hard-delete - any loan history (even fully returned) blocks it. */
  countActiveBorrowsForBook(bookId: number, madrasaId: number) {
    return prisma.libraryBorrowRecord.count({ where: { bookId, madrasaId } });
  }

  /* ================= BORROW RECORDS ================= */

  findBorrowRecords(madrasaId: number, where: Prisma.LibraryBorrowRecordWhereInput) {
    return prisma.libraryBorrowRecord.findMany({
      where: { madrasaId, ...where },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        book: { select: { id: true, title: true, author: true } },
        student: { select: { id: true, nameBn: true, roll: true } },
        teacher: { select: { id: true, nameBn: true } },
      },
    });
  }

  findBorrowRecordForTenant(id: number, madrasaId: number) {
    return prisma.libraryBorrowRecord.findFirst({
      where: { id, madrasaId },
      include: {
        book: { select: { id: true, title: true, author: true } },
        student: { select: { id: true, nameBn: true, roll: true } },
        teacher: { select: { id: true, nameBn: true } },
      },
    });
  }

  findBookForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.libraryBook.findFirst({ where: { id, madrasaId } });
  }

  findBorrowRecordForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.libraryBorrowRecord.findFirst({ where: { id, madrasaId } });
  }

  decrementBookCopiesOnTx(tx: TransactionClient, bookId: number) {
    return tx.libraryBook.update({ where: { id: bookId }, data: { copiesAvailable: { decrement: 1 } } });
  }

  incrementBookCopiesOnTx(tx: TransactionClient, bookId: number) {
    return tx.libraryBook.update({ where: { id: bookId }, data: { copiesAvailable: { increment: 1 } } });
  }

  createBorrowRecordOnTx(tx: TransactionClient, data: Record<string, unknown>) {
    return tx.libraryBorrowRecord.create({ data: data as any });
  }

  updateBorrowRecordOnTx(tx: TransactionClient, id: number, data: Record<string, unknown>) {
    return tx.libraryBorrowRecord.update({ where: { id }, data });
  }

  updateBorrowRecord(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.libraryBorrowRecord.updateMany({ where: { id, madrasaId }, data });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  /* ================= SETTINGS ================= */

  findFinePerDaySetting(madrasaId: number) {
    return prisma.setting.findFirst({
      where: { name: LIBRARY_FINE_PER_DAY_SETTING_NAME, madrasaId },
      select: { value: true },
    });
  }

  upsertFinePerDaySetting(madrasaId: number, value: string) {
    return prisma.setting.upsert({
      where: { madrasaId_name: { madrasaId, name: LIBRARY_FINE_PER_DAY_SETTING_NAME } },
      update: { value },
      create: { name: LIBRARY_FINE_PER_DAY_SETTING_NAME, value, madrasaId },
    });
  }

  /* ================= DASHBOARD SUMMARY ================= */

  aggregateBookTotals(madrasaId: number) {
    return prisma.libraryBook.aggregate({
      where: { madrasaId, isActive: true },
      _sum: { copiesTotal: true, copiesAvailable: true },
      _count: { _all: true },
    });
  }

  groupBorrowRecordsByStatus(madrasaId: number) {
    return prisma.libraryBorrowRecord.groupBy({
      by: ["status"],
      where: { madrasaId },
      _count: { _all: true },
    });
  }

  countOverdueBorrows(madrasaId: number) {
    return prisma.libraryBorrowRecord.count({
      where: { madrasaId, status: "BORROWED", dueDate: { lt: new Date() } },
    });
  }

  aggregateUnsettledFines(madrasaId: number) {
    return prisma.libraryBorrowRecord.aggregate({
      where: { madrasaId, status: "RETURNED", fineAmount: { gt: 0 }, fineSettled: false },
      _sum: { fineAmount: true },
      _count: { _all: true },
    });
  }

  groupBooksByCategory(madrasaId: number) {
    return prisma.libraryBook.groupBy({
      by: ["categoryId"],
      where: { madrasaId, isActive: true },
      _count: { _all: true },
    });
  }

  findCategoryNames(categoryIds: number[]) {
    return prisma.libraryBookCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
  }

  /** Monthly borrow counts for the last `limit` months with at least one
   * borrow, newest first - feeds the লাইব্রেরি dashboard's circulation
   * trend chart. Raw SQL since GROUP BY on a formatted date has no clean
   * Prisma equivalent (same reasoning as dashboard.repository.ts's
   * period-based queries). */
  findMonthlyBorrowTrend(madrasaId: number, limit: number) {
    return prisma.$queryRaw<{ period: string; count: bigint }[]>`
      SELECT to_char(borrowed_at, 'YYYY-MM') AS period, COUNT(*) AS count
      FROM library_borrow_records
      WHERE madrasa_id = ${madrasaId}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${limit}
    `;
  }
}

export const libraryRepository = new LibraryRepository();
