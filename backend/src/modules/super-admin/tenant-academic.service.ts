import type { InstitutionType } from "@prisma/client";
import type { TransactionClient } from "../../shared/database/transaction";
import { BadRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";
import { appendSerials } from "../../shared/utils/serial.util";

type Selection = { divisionIds: number[]; classIds: number[]; bookIds: number[] };

/** Persistent, tenant-owned snapshots of the selected Super Admin templates.
 * API IDs remain globally unique; local numbers are scoped by institution and parent. */
export async function snapshotTenantAcademicOnTx(
  tx: TransactionClient,
  madrasaId: number,
  selection: Selection,
  options: { replace?: boolean; institutionType?: InstitutionType } = {},
) {
  const lockKey = "tenant-academic:" + madrasaId;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  const tenant = await tx.madrasa.findUniqueOrThrow({
    where: { id: madrasaId },
    select: { institutionType: true },
  });
  const institutionType = options.institutionType ?? tenant.institutionType;
  const [divisions, classes, books, ownedDivisions, ownedClasses, ownedBooks] = await Promise.all([
    tx.division.findMany({
      where: { ownerMadrasaId: null, institutionType },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    tx.class.findMany({
      where: {
        ownerMadrasaId: null,
        division: { ownerMadrasaId: null, institutionType },
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    tx.book.findMany({
      where: {
        ownerMadrasaId: null,
        class: { ownerMadrasaId: null, division: { ownerMadrasaId: null, institutionType } },
      },
      include: { class: { include: { division: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    tx.division.findMany({ where: { ownerMadrasaId: madrasaId } }),
    tx.class.findMany({ where: { ownerMadrasaId: madrasaId } }),
    tx.book.findMany({ where: { ownerMadrasaId: madrasaId } }),
  ]);
  // Existing snapshots survive deletion/deactivation of their source templates.
  for (const row of ownedDivisions) {
    if (row.sourceTemplateId != null && !divisions.some((d) => d.id === row.sourceTemplateId)) {
      divisions.push({ ...row, id: row.sourceTemplateId, ownerMadrasaId: null });
    }
  }
  for (const row of ownedClasses) {
    if (row.sourceTemplateId != null && !classes.some((c) => c.id === row.sourceTemplateId)) {
      const parent = ownedDivisions.find((d) => d.id === row.divisionId);
      classes.push({
        ...row,
        id: row.sourceTemplateId,
        divisionId: parent?.sourceTemplateId ?? row.divisionId,
        ownerMadrasaId: null,
      });
    }
  }
  for (const row of ownedBooks) {
    if (row.sourceTemplateId != null && !books.some((b) => b.id === row.sourceTemplateId)) {
      const parent = ownedClasses.find((c) => c.id === row.classId);
      if (!parent) continue;
      const division = ownedDivisions.find((d) => d.id === parent.divisionId) ?? null;
      books.push({
        ...row,
        id: row.sourceTemplateId,
        classId: parent.sourceTemplateId ?? parent.id,
        ownerMadrasaId: null,
        class: { ...parent, division },
      });
    }
  }
  const allowed = (ids: number[], rows: { id: number }[]) =>
    ids.every((id) => rows.some((r) => r.id === id));
  if (
    !allowed(selection.divisionIds, [...divisions, ...ownedDivisions]) ||
    !allowed(selection.classIds, [...classes, ...ownedClasses]) ||
    !allowed(selection.bookIds, [...books, ...ownedBooks])
  ) {
    throw new BadRequestError(
      t({
        bn: "নির্বাচিত বিভাগ, শ্রেণি বা বিষয় এই প্রতিষ্ঠানের টেমপ্লেটে নেই",
        en: "Selected division, class or subject is not in this institution's templates",
      }),
    );
  }

  const divisionMap = new Map(
    ownedDivisions
      .filter((r) => r.sourceTemplateId != null)
      .map((r) => [r.sourceTemplateId!, r.id]),
  );
  const classMap = new Map(
    ownedClasses.filter((r) => r.sourceTemplateId != null).map((r) => [r.sourceTemplateId!, r.id]),
  );
  const bookMap = new Map(
    ownedBooks.filter((r) => r.sourceTemplateId != null).map((r) => [r.sourceTemplateId!, r.id]),
  );
  const selectedDivisions = divisions.filter(
    (r) =>
      (!options.replace && !selection.divisionIds.length) || selection.divisionIds.includes(r.id),
  );
  const selectedDivisionIds = new Set(selectedDivisions.map((r) => r.id));
  const selectedClasses = classes.filter(
    (r) =>
      r.divisionId != null &&
      selectedDivisionIds.has(r.divisionId) &&
      ((!options.replace && !selection.classIds.length) || selection.classIds.includes(r.id)),
  );
  const selectedClassIds = new Set(selectedClasses.map((r) => r.id));
  const selectedBooks = books.filter(
    (r) =>
      selectedClassIds.has(r.classId) &&
      ((!options.replace && !selection.bookIds.length) || selection.bookIds.includes(r.id)),
  );

  // Existing snapshots are never refreshed from the catalogue on an edit.
  // Only newly selected templates are copied; tenant names/marks/order survive.
  const divisionLinks = await tx.madrasaDivision.findMany({ where: { madrasaId } });
  const classLinks = await tx.madrasaClass.findMany({ where: { madrasaId } });
  const bookLinks = await tx.madrasaBook.findMany({ where: { madrasaId } });
  const divisionSerials = appendSerials(
    selectedDivisions.filter((r) => !divisionMap.has(r.id)),
    () => null,
    divisionLinks.map((r) => ({ parentId: null, sortOrder: r.sortOrder })),
  );
  if (divisionSerials.length) {
    const copies = await tx.division.createManyAndReturn({
      data: divisionSerials.map(({ item, sortOrder }) => ({
        name: item.name,
        nameBn: item.nameBn,
        institutionType,
        sortOrder,
        ownerMadrasaId: madrasaId,
        sourceTemplateId: item.id,
      })),
    });
    ownedDivisions.push(...copies);
    copies.forEach((r) => divisionMap.set(r.sourceTemplateId!, r.id));
  }
  const classSerials = appendSerials(
    selectedClasses.filter((r) => !classMap.has(r.id)),
    (r) => divisionMap.get(r.divisionId!)!,
    classLinks.map((r) => ({
      parentId: ownedClasses.find((c) => c.id === r.classId)?.divisionId ?? null,
      sortOrder: r.sortOrder,
    })),
  );
  if (classSerials.length) {
    const copies = await tx.class.createManyAndReturn({
      data: classSerials.map(({ item, sortOrder }) => ({
        name: item.name,
        nameBn: item.nameBn,
        divisionId: divisionMap.get(item.divisionId!)!,
        isActive: item.isActive,
        sortOrder,
        ownerMadrasaId: madrasaId,
        sourceTemplateId: item.id,
      })),
    });
    ownedClasses.push(...copies);
    copies.forEach((r) => classMap.set(r.sourceTemplateId!, r.id));
  }
  const bookSerials = appendSerials(
    selectedBooks.filter((r) => !bookMap.has(r.id)),
    (r) => classMap.get(r.classId)!,
    bookLinks.map((r) => ({
      parentId: ownedBooks.find((b) => b.id === r.bookId)?.classId ?? null,
      sortOrder: r.sortOrder,
    })),
  );
  if (bookSerials.length) {
    const copies = await tx.book.createManyAndReturn({
      data: bookSerials.map(({ item, sortOrder }) => ({
        name: item.name,
        nameBn: item.nameBn,
        classId: classMap.get(item.classId)!,
        sortOrder,
        ownerMadrasaId: madrasaId,
        sourceTemplateId: item.id,
      })),
    });
    ownedBooks.push(...copies);
    copies.forEach((r) => bookMap.set(r.sourceTemplateId!, r.id));
  }

  if (options.replace) {
    await tx.madrasaDivision.updateMany({
      where: { madrasaId, division: { sourceTemplateId: { not: null } } },
      data: { isActive: 0 },
    });
    await tx.madrasaClass.updateMany({
      where: { madrasaId, class: { sourceTemplateId: { not: null } } },
      data: { isActive: 0 },
    });
    await tx.madrasaBook.updateMany({
      where: { madrasaId, book: { sourceTemplateId: { not: null } } },
      data: { isActive: 0 },
    });
  }
  const wantedDivisions = new Set([
    ...selectedDivisions.map((r) => divisionMap.get(r.id)!),
    ...ownedDivisions.filter((r) => selection.divisionIds.includes(r.id)).map((r) => r.id),
  ]);
  const wantedClasses = new Set([
    ...selectedClasses.map((r) => classMap.get(r.id)!),
    ...ownedClasses.filter((r) => selection.classIds.includes(r.id)).map((r) => r.id),
  ]);
  const wantedBooks = new Set([
    ...selectedBooks.map((r) => bookMap.get(r.id)!),
    ...ownedBooks.filter((r) => selection.bookIds.includes(r.id)).map((r) => r.id),
  ]);
  const newDivisionLinks = [...wantedDivisions]
    .filter((id) => !divisionLinks.some((l) => l.divisionId === id))
    .map((divisionId) => ({
      madrasaId,
      divisionId,
      sortOrder: ownedDivisions.find((r) => r.id === divisionId)!.sortOrder,
    }));
  const newClassLinks = [...wantedClasses]
    .filter((id) => !classLinks.some((l) => l.classId === id))
    .map((classId) => ({
      madrasaId,
      classId,
      sortOrder: ownedClasses.find((r) => r.id === classId)!.sortOrder,
    }));
  const newBookLinks = [...wantedBooks]
    .filter((id) => !bookLinks.some((l) => l.bookId === id))
    .map((bookId) => {
      const copy = ownedBooks.find((r) => r.id === bookId)!;
      const source = selectedBooks.find((r) => r.id === copy.sourceTemplateId);
      const fullMark =
        source?.class.division?.keyName === "nazera_hifz" && source.name !== source.class.name
          ? 50
          : 100;
      return { madrasaId, bookId, fullMark, sortOrder: copy.sortOrder };
    });
  if (newDivisionLinks.length) await tx.madrasaDivision.createMany({ data: newDivisionLinks });
  if (newClassLinks.length) await tx.madrasaClass.createMany({ data: newClassLinks });
  if (newBookLinks.length) await tx.madrasaBook.createMany({ data: newBookLinks });
  await tx.madrasaDivision.updateMany({
    where: { madrasaId, divisionId: { in: [...wantedDivisions] } },
    data: { isActive: 1, deletedAt: null },
  });
  await tx.madrasaClass.updateMany({
    where: { madrasaId, classId: { in: [...wantedClasses] } },
    data: { isActive: 1, deletedAt: null },
  });
  await tx.madrasaBook.updateMany({
    where: { madrasaId, bookId: { in: [...wantedBooks] } },
    data: { isActive: 1, deletedAt: null },
  });
  return { classMap };
}

/** Translate class-specific fee templates before writing tenant fee rows. */
export function remapFeeTemplates<T extends { classId: number | null }>(
  templates: T[],
  classMap: Map<number, number>,
): T[] {
  return templates.flatMap((row) =>
    row.classId === null
      ? [row]
      : classMap.has(row.classId)
        ? [{ ...row, classId: classMap.get(row.classId)! }]
        : [],
  );
}
