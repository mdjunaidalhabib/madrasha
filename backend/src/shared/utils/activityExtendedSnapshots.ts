import { prisma } from "../database/prisma";
import type { ActivitySnapshot } from "./activityDetails";

type Row = { madrasaId: number | null } & Record<string, unknown>;
function snapshot(
  row: Row | null,
  noun: string,
  name: string,
  labels: Record<string, string>,
): ActivitySnapshot | null {
  if (!row?.madrasaId) return null;
  const display = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "boolean") return value ? "হ্যাঁ" : "না";
    return String(value);
  };
  return {
    madrasaId: row.madrasaId,
    title: `${noun}: ${display(row[name])}`,
    fields: Object.fromEntries(
      Object.entries(labels).map(([key, label]) => [label, display(row[key])]),
    ),
  };
}

/** Explicit selects ensure secrets, photos and large content never enter snapshots. */
export const extendedSnapshotLoaders: Record<
  string,
  (id: number) => Promise<ActivitySnapshot | null>
> = {
  payroll: async (id) => {
    const row = await prisma.payrollRecord.findUnique({
      where: { id },
      select: {
        madrasaId: true,
        month: true,
        basicSalary: true,
        allowances: true,
        deductions: true,
        netAmount: true,
        status: true,
        teacher: { select: { nameBn: true } },
      },
    });
    return snapshot(
      row ? { ...row, teacherName: row.teacher.nameBn } : null,
      "বেতন",
      "teacherName",
      {
        teacherName: "শিক্ষক",
        month: "মাস",
        basicSalary: "মূল বেতন",
        allowances: "ভাতা",
        deductions: "কর্তন",
        netAmount: "প্রাপ্য বেতন",
        status: "অবস্থা",
      },
    );
  },
  "library/borrow-records": async (id) => {
    const row = await prisma.libraryBorrowRecord.findUnique({
      where: { id },
      select: {
        madrasaId: true,
        dueDate: true,
        returnedAt: true,
        status: true,
        fineAmount: true,
        fineSettled: true,
        book: { select: { title: true } },
        student: { select: { nameBn: true } },
        teacher: { select: { nameBn: true } },
      },
    });
    return snapshot(
      row
        ? {
            ...row,
            bookTitle: row.book.title,
            borrower: row.student?.nameBn ?? row.teacher?.nameBn,
          }
        : null,
      "বই ইস্যু",
      "bookTitle",
      {
        bookTitle: "বই",
        borrower: "গ্রহীতা",
        dueDate: "ফেরতের শেষ তারিখ",
        returnedAt: "ফেরতের তারিখ",
        status: "অবস্থা",
        fineAmount: "জরিমানা",
        fineSettled: "জরিমানা নিষ্পত্তি",
      },
    );
  },
  staff: async (id) =>
    snapshot(
      await prisma.staff.findUnique({
        where: { id },
        select: {
          madrasaId: true,
          nameBn: true,
          nameEn: true,
          nameAr: true,
          registrationNo: true,
          designation: true,
          department: true,
          phone: true,
          email: true,
          salary: true,
          joiningDate: true,
          isActive: true,
        },
      }),
      "স্টাফ",
      "nameBn",
      {
        nameBn: "নাম",
        nameEn: "নাম (ইংরেজি)",
        nameAr: "নাম (আরবি)",
        registrationNo: "রেজিস্ট্রেশন নম্বর",
        designation: "পদবি",
        department: "দপ্তর",
        phone: "মোবাইল",
        email: "ইমেইল",
        salary: "বেতন",
        joiningDate: "যোগদানের তারিখ",
        isActive: "অবস্থা",
      },
    ),
  sessions: async (id) =>
    snapshot(
      await prisma.session.findUnique({
        where: { id },
        select: { madrasaId: true, name: true, startDate: true, endDate: true, isActive: true },
      }),
      "শিক্ষাবর্ষ",
      "name",
      { name: "নাম", startDate: "শুরুর তারিখ", endDate: "শেষ তারিখ", isActive: "সক্রিয়" },
    ),
  "exam-rooms": async (id) =>
    snapshot(
      await prisma.examRoom.findUnique({
        where: { id },
        select: {
          madrasaId: true,
          name: true,
          code: true,
          capacity: true,
          floor: true,
          location: true,
          isActive: true,
        },
      }),
      "পরীক্ষার কক্ষ",
      "name",
      {
        name: "নাম",
        code: "কোড",
        capacity: "আসন সংখ্যা",
        floor: "তলা",
        location: "অবস্থান",
        isActive: "সক্রিয়",
      },
    ),
  "attendance-sessions/sessions": async (id) =>
    snapshot(
      await prisma.attendanceSession.findUnique({
        where: { id },
        select: {
          madrasaId: true,
          name: true,
          startTime: true,
          endTime: true,
          residentialOnly: true,
          sortOrder: true,
          isActive: true,
        },
      }),
      "হাজিরার সেশন",
      "name",
      {
        name: "নাম",
        startTime: "শুরুর সময়",
        endTime: "শেষ সময়",
        residentialOnly: "শুধু আবাসিক",
        sortOrder: "ক্রম",
        isActive: "সক্রিয়",
      },
    ),
  "attendance-leaves": async (id) =>
    snapshot(
      await prisma.leaveRequest.findUnique({
        where: { id },
        select: {
          madrasaId: true,
          attendeeType: true,
          attendeeId: true,
          fromDate: true,
          toDate: true,
          leaveType: true,
          reason: true,
          status: true,
          reviewNote: true,
        },
      }),
      "ছুটির আবেদন",
      "reason",
      {
        attendeeType: "আবেদনকারীর ধরন",
        attendeeId: "আবেদনকারীর আইডি",
        fromDate: "শুরুর তারিখ",
        toDate: "শেষ তারিখ",
        leaveType: "ছুটির ধরন",
        reason: "কারণ",
        status: "অবস্থা",
        reviewNote: "পর্যালোচনার মন্তব্য",
      },
    ),
  "attendance-devices/devices": async (id) =>
    snapshot(
      await prisma.attendanceDevice.findUnique({
        where: { id },
        select: {
          madrasaId: true,
          name: true,
          deviceCode: true,
          ipAddress: true,
          port: true,
          isActive: true,
        },
      }),
      "হাজিরার ডিভাইস",
      "name",
      {
        name: "নাম",
        deviceCode: "ডিভাইস কোড",
        ipAddress: "আইপি ঠিকানা",
        port: "পোর্ট",
        isActive: "সক্রিয়",
      },
    ),
  "library/books": async (id) =>
    snapshot(
      await prisma.libraryBook.findUnique({
        where: { id },
        select: {
          madrasaId: true,
          title: true,
          author: true,
          isbn: true,
          publisher: true,
          shelfLocation: true,
          copiesTotal: true,
          copiesAvailable: true,
          isActive: true,
        },
      }),
      "লাইব্রেরির বই",
      "title",
      {
        title: "শিরোনাম",
        author: "লেখক",
        isbn: "ISBN",
        publisher: "প্রকাশক",
        shelfLocation: "তাক",
        copiesTotal: "মোট কপি",
        copiesAvailable: "উপলব্ধ কপি",
        isActive: "সক্রিয়",
      },
    ),
  "library/categories": async (id) =>
    snapshot(
      await prisma.libraryBookCategory.findUnique({
        where: { id },
        select: { madrasaId: true, name: true },
      }),
      "বইয়ের বিভাগ",
      "name",
      { name: "নাম" },
    ),
  roles: async (id) => {
    const row = await prisma.role.findUnique({
      where: { id },
      select: {
        madrasaId: true,
        nameBn: true,
        keyName: true,
        rolePermissions: { select: { permission: { select: { keyName: true } } } },
      },
    });
    return snapshot(
      row
        ? {
            ...row,
            permissions: row.rolePermissions
              .map((p) => p.permission.keyName)
              .sort()
              .join(", "),
          }
        : null,
      "রোল",
      "nameBn",
      { nameBn: "নাম", keyName: "কোড", permissions: "পারমিশন" },
    );
  },
};
