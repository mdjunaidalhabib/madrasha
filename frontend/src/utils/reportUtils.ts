export const cellValue = (row: Record<string, any>, key: string) => {
  const value = row?.[key];
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

export const getRowDivisionId = (row: Record<string, any>) =>
  row.division_id ||
  row.madrasa_division_id ||
  row.divisionId ||
  row.division?.division_id ||
  row.division?.id ||
  "";

export const getRowClassId = (row: Record<string, any>) =>
  row.class_id || row.madrasa_class_id || row.classId || row.class?.class_id || row.class?.id || "";
