import { formatCurrency, getLang, type Lang } from "@madrasha/shared-ui/src/i18n";

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
  mobile: string | null;
  paymentMethod: string | null;
  note: string | null;
  entryDate: string | null;
  entryTime: string | null;
};

/** Money in `lang` (defaults to the current UI language). Print output passes the print language. */
export const money = (value: number | string, lang: Lang = getLang()) => formatCurrency(Number(value || 0), lang);

export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const daysAgoInput = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInput(date);
};

export const toTimeInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const partyName = (row: AccountRow) => (row.type === "income" ? row.donorName : row.receiverName) || "-";
