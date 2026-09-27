import { Prisma } from "@prisma/client";

/**
 * Class/Division rows are a shared catalogue - many madrasas link the same
 * row through MadrasaClass/MadrasaDivision. A madrasa's rename lives on its
 * own link row (MadrasaClass.nameBn / MadrasaDivision.nameBn), so every
 * tenant-facing read must prefer that over the catalogue name.
 *
 * Use these selects in place of `{ nameBn: true, name: true }` on a nested
 * `class`/`classRef`/`division` relation, then read the name with
 * tenantClassName()/tenantDivisionName().
 */
export const tenantClassNameSelect = (madrasaId: number) =>
  Prisma.validator<Prisma.ClassSelect>()({
    nameBn: true,
    name: true,
    madrasaClasses: { where: { madrasaId }, select: { nameBn: true }, take: 1 },
  });

export const tenantDivisionNameSelect = (madrasaId: number) =>
  Prisma.validator<Prisma.DivisionSelect>()({
    nameBn: true,
    name: true,
    madrasaDivisions: { where: { madrasaId }, select: { nameBn: true }, take: 1 },
  });

type NameRow = { nameBn?: string | null; name?: string | null } | null | undefined;

export const tenantClassName = (
  row: (NameRow & { madrasaClasses?: { nameBn: string | null }[] }) | null | undefined,
): string | null => row?.madrasaClasses?.[0]?.nameBn || row?.nameBn || row?.name || null;

export const tenantDivisionName = (
  row: (NameRow & { madrasaDivisions?: { nameBn: string | null }[] }) | null | undefined,
): string | null => row?.madrasaDivisions?.[0]?.nameBn || row?.nameBn || row?.name || null;

/** Folds the tenant override into `nameBn` and drops the helper relation, so
 * a row fetched with tenantClassNameSelect keeps the plain
 * `{ nameBn, name }` shape callers/the frontend already read. */
export const withTenantClassName = <T extends { nameBn: string | null; madrasaClasses: { nameBn: string | null }[] }>(
  row: T | null | undefined,
): (Omit<T, "madrasaClasses"> & { nameBn: string | null }) | null => {
  if (!row) return null;
  const { madrasaClasses: _override, ...rest } = row;
  return { ...rest, nameBn: tenantClassName(row) };
};

export const withTenantDivisionName = <T extends { nameBn: string | null; madrasaDivisions: { nameBn: string | null }[] }>(
  row: T | null | undefined,
): (Omit<T, "madrasaDivisions"> & { nameBn: string | null }) | null => {
  if (!row) return null;
  const { madrasaDivisions: _override, ...rest } = row;
  return { ...rest, nameBn: tenantDivisionName(row) };
};

/** For reads that already go through the tenant's own MadrasaClass /
 * MadrasaDivision link row: `link.nameBn` override, else the catalogue name. */
export const linkName = (link: { nameBn: string | null }, catalogue: NameRow): string | null =>
  link.nameBn || catalogue?.nameBn || catalogue?.name || null;
