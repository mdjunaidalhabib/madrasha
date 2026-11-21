import { describe, expect, it, vi } from "vitest";
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
import { snapshotTenantAcademicOnTx, remapFeeTemplates } from "../tenant-academic.service";
import type { TransactionClient } from "../../../shared/database/transaction";

function setup() {
  let nextId = 100;
  const divisions: any[] = [
    {
      id: 1,
      name: "Nurani",
      nameBn: "Nurani",
      institutionType: "MADRASA",
      ownerMadrasaId: null,
      sortOrder: 0,
      sourceTemplateId: null,
    },
    {
      id: 2,
      name: "School",
      nameBn: "School",
      institutionType: "SCHOOL",
      ownerMadrasaId: null,
      sortOrder: 1,
      sourceTemplateId: null,
    },
  ];
  const classes: any[] = [
    {
      id: 10,
      name: "First",
      nameBn: "First",
      divisionId: 1,
      ownerMadrasaId: null,
      isActive: true,
      sortOrder: 0,
      sourceTemplateId: null,
    },
  ];
  const books: any[] = [
    {
      id: 20,
      name: "Arabic",
      nameBn: "Arabic",
      classId: 10,
      ownerMadrasaId: null,
      sortOrder: 0,
      sourceTemplateId: null,
    },
  ];
  const divisionLinks: any[] = [],
    classLinks: any[] = [],
    bookLinks: any[] = [];
  const master = (rows: any[], kind: string) => ({
    findMany: vi.fn(async ({ where, include }: any) =>
      rows
        .filter((r) => {
          if (r.ownerMadrasaId !== where.ownerMadrasaId) return false;
          if (where.institutionType && r.institutionType !== where.institutionType) return false;
          if (where.division)
            return (
              divisions.find((d) => d.id === r.divisionId)?.institutionType ===
              where.division.institutionType
            );
          if (where.class)
            return (
              divisions.find((d) => d.id === classes.find((c) => c.id === r.classId)?.divisionId)
                ?.institutionType === where.class.division.institutionType
            );
          return true;
        })
        .map((r) =>
          include && kind === "book"
            ? {
                ...r,
                class: {
                  ...classes.find((c) => c.id === r.classId),
                  division: divisions.find(
                    (d) => d.id === classes.find((c) => c.id === r.classId)?.divisionId,
                  ),
                },
              }
            : { ...r },
        ),
    ),
    createManyAndReturn: vi.fn(async ({ data }: any) => {
      const created = data.map((item: any) => ({ id: nextId++, ...item }));
      rows.push(...created);
      return created.map((r: any) => ({ ...r }));
    }),
  });
  const links = (rows: any[], masters: any[], field: string) => ({
    findMany: vi.fn(async ({ where }: any) =>
      rows.filter((r) => r.madrasaId === where.madrasaId).map((r) => ({ ...r })),
    ),
    createMany: vi.fn(async ({ data }: any) => {
      rows.push(
        ...data.map((item: any) => ({ id: nextId++, isActive: 1, deletedAt: null, ...item })),
      );
      return { count: data.length };
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const matched = rows.filter(
        (r) =>
          r.madrasaId === where.madrasaId &&
          (where[field]
            ? where[field].in.includes(r[field])
            : masters.find((m) => m.id === r[field])?.sourceTemplateId != null),
      );
      matched.forEach((r) => Object.assign(r, data));
      return { count: matched.length };
    }),
  });
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    madrasa: { findUniqueOrThrow: vi.fn(async () => ({ institutionType: "MADRASA" })) },
    division: master(divisions, "division"),
    class: master(classes, "class"),
    book: master(books, "book"),
    madrasaDivision: links(divisionLinks, divisions, "divisionId"),
    madrasaClass: links(classLinks, classes, "classId"),
    madrasaBook: links(bookLinks, books, "bookId"),
  };
  return {
    tx: tx as unknown as TransactionClient,
    divisions,
    classes,
    books,
    divisionLinks,
    classLinks,
    bookLinks,
  };
}
const selection = { divisionIds: [1], classIds: [10], bookIds: [20] };

describe("private academic snapshots", () => {
  it("keeps existing snapshots usable after the source templates are removed", async () => {
    const s = setup();
    await snapshotTenantAcademicOnTx(s.tx, 7, selection);
    for (const rows of [s.divisions, s.classes, s.books]) {
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i].ownerMadrasaId === null) rows.splice(i, 1);
    }
    const bookId = s.bookLinks[0].bookId;
    await snapshotTenantAcademicOnTx(s.tx, 7, selection, { replace: true });
    expect(s.bookLinks[0].bookId).toBe(bookId);
    expect(s.bookLinks[0].isActive).toBe(1);
  });
  it("creates independent IDs and remaps both parent levels for two institutions", async () => {
    const s = setup();
    await snapshotTenantAcademicOnTx(s.tx, 7, selection);
    await snapshotTenantAcademicOnTx(s.tx, 8, selection);
    for (const tenantId of [7, 8]) {
      const division = s.divisions.find((r) => r.ownerMadrasaId === tenantId);
      const cls = s.classes.find((r) => r.ownerMadrasaId === tenantId);
      const book = s.books.find((r) => r.ownerMadrasaId === tenantId);
      expect(division.id).not.toBe(1);
      expect(cls.id).not.toBe(10);
      expect(book.id).not.toBe(20);
      expect(cls.divisionId).toBe(division.id);
      expect(book.classId).toBe(cls.id);
      expect(s.bookLinks.find((r) => r.madrasaId === tenantId).bookId).toBe(book.id);
    }
    expect(s.divisions.filter((r) => r.ownerMadrasaId != null)).toHaveLength(2);
  });

  it("keeps tenant edits and existing IDs when the same templates are selected again", async () => {
    const s = setup();
    await snapshotTenantAcademicOnTx(s.tx, 7, selection);
    s.divisions.find((r) => r.ownerMadrasaId === 7).nameBn = "My division";
    s.bookLinks[0].fullMark = 75;
    const ids = s.books.map((r) => r.id);
    await snapshotTenantAcademicOnTx(s.tx, 7, selection, { replace: true });
    expect(s.books.map((r) => r.id)).toEqual(ids);
    expect(s.divisions.find((r) => r.ownerMadrasaId === 7).nameBn).toBe("My division");
    expect(s.bookLinks[0].fullMark).toBe(75);
  });

  it("rejects another institution's private IDs and a different institution type", async () => {
    const s = setup();
    await snapshotTenantAcademicOnTx(s.tx, 7, selection);
    await expect(
      snapshotTenantAcademicOnTx(s.tx, 8, {
        ...selection,
        divisionIds: [s.divisionLinks[0].divisionId],
      }),
    ).rejects.toThrow();
    await expect(
      snapshotTenantAcademicOnTx(s.tx, 7, { ...selection, divisionIds: [2] }),
    ).rejects.toThrow();
  });

  it("allows explicit empty selections on edit and preserves manually added rows", async () => {
    const s = setup();
    await snapshotTenantAcademicOnTx(s.tx, 7, selection);
    s.divisions.push({ id: 999, ownerMadrasaId: 7, sourceTemplateId: null, sortOrder: 1 });
    s.divisionLinks.push({ id: 999, madrasaId: 7, divisionId: 999, isActive: 1, sortOrder: 1 });
    await snapshotTenantAcademicOnTx(
      s.tx,
      7,
      { divisionIds: [], classIds: [], bookIds: [] },
      { replace: true },
    );
    expect(s.divisionLinks.find((r) => r.divisionId !== 999).isActive).toBe(0);
    expect(s.divisionLinks.find((r) => r.divisionId === 999).isActive).toBe(1);
    expect(s.classLinks[0].isActive).toBe(0);
    expect(s.bookLinks[0].isActive).toBe(0);
  });

  it("relinks existing private IDs after a factory reset", async () => {
    const s = setup();
    await snapshotTenantAcademicOnTx(s.tx, 7, selection);
    const privateSelection = {
      divisionIds: [s.divisionLinks[0].divisionId],
      classIds: [s.classLinks[0].classId],
      bookIds: [s.bookLinks[0].bookId],
    };
    s.divisionLinks.length = s.classLinks.length = s.bookLinks.length = 0;
    await snapshotTenantAcademicOnTx(s.tx, 7, privateSelection);
    expect(s.divisionLinks[0].divisionId).toBe(privateSelection.divisionIds[0]);
    expect(s.classLinks[0].classId).toBe(privateSelection.classIds[0]);
    expect(s.bookLinks[0].bookId).toBe(privateSelection.bookIds[0]);
  });

  it("remaps class-specific fee templates and keeps generic defaults", () => {
    expect(
      remapFeeTemplates(
        [
          { classId: null, amount: 5 },
          { classId: 10, amount: 10 },
          { classId: 11, amount: 15 },
        ],
        new Map([[10, 110]]),
      ),
    ).toEqual([
      { classId: null, amount: 5 },
      { classId: 110, amount: 10 },
    ]);
  });
});
