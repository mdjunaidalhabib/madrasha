/**
 * Builds a raw-SQL GROUP BY period expression for daily/monthly/yearly trend
 * aggregation. `dateColumn` must be a server-constructed SQL fragment (never
 * user input) since it is interpolated directly into the query.
 */
export function buildPeriodExpr(groupBy: string, dateColumn: string): string {
  if (groupBy === "daily") return `CAST(${dateColumn} AS DATE)`;
  if (groupBy === "yearly") return `EXTRACT(YEAR FROM ${dateColumn})`;
  return `TO_CHAR(${dateColumn}, 'YYYY-MM')`;
}
