export type AccountType = "income" | "expense";

export type AccountRow = {
  id: number;
  type: AccountType;
  amount: string | number;
  category: string | null;
  receiptNo: string | null;
  voucherNo: string | null;
  fund: string | null;
  donorName: string | null;
  receiverName: string | null;
  address: string | null;
  paymentMethod: string | null;
  entryDate: string | null;
  entryTime: string | null;
};

export const money = (value: number | string) => `৳ ${Number(value || 0).toLocaleString("bn-BD")}`;

export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export const toTimeInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const partyName = (row: AccountRow) => (row.type === "income" ? row.donorName : row.receiverName) || "-";
