import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";

export interface DashboardSession {
  id: number;
  name: string;
  divisionId: number | null;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export interface DashboardScope {
  mode: "active" | "all" | "session";
  sessions: DashboardSession[];
  selected: DashboardSession[];
}

export function resolveDashboardScope(
  sessions: DashboardSession[],
  selection = "active",
): DashboardScope {
  if (selection === "all") return { mode: "all", sessions, selected: sessions };
  if (selection === "active")
    return { mode: "active", sessions, selected: sessions.filter((s) => s.isActive) };
  if (!/^[1-9]\d*$/.test(selection) || !Number.isSafeInteger(Number(selection))) {
    throw new BadRequestError("Invalid dashboard session");
  }
  const session = sessions.find((s) => s.id === Number(selection));
  if (!session) throw new NotFoundError("Session not found");
  return { mode: "session", sessions, selected: [session] };
}

export function studentSessionWhere(scope: DashboardScope) {
  return scope.mode === "all" ? {} : { sessionId: { in: scope.selected.map((s) => s.id) } };
}

// Columns are server-owned SQL fragments, never request input. OR combines
// overlapping division calendars without counting a transaction twice.
export function sessionDateSql(scope: DashboardScope, column: Prisma.Sql): Prisma.Sql {
  if (scope.mode === "all") return Prisma.sql`TRUE`;
  if (!scope.selected.length) return Prisma.sql`FALSE`;
  return Prisma.sql`(${Prisma.join(
    scope.selected.map(
      (s) =>
        Prisma.sql`(${column} >= ${s.startDate} AND ${column} < ${new Date(s.endDate.getTime() + 86400000)})`,
    ),
    " OR ",
  )})`;
}

export function sessionDateWhere(scope: DashboardScope): Prisma.DateTimeFilter[] | undefined {
  if (scope.mode === "all") return undefined;
  return scope.selected.map((s) => ({
    gte: s.startDate,
    lt: new Date(s.endDate.getTime() + 86400000),
  }));
}
