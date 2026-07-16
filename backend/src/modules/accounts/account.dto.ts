export interface CreateIncomeRequestDto {
  amount: number | string;
  receipt_no?: string;
  fund: string;
  category: string;
  donor_name: string;
  address?: string;
  mobile?: string;
  payment_method: string;
  entry_date?: string;
  entry_time?: string;
}

export interface CreateExpenseRequestDto {
  amount: number | string;
  voucher_no?: string;
  fund: string;
  category: string;
  receiver_name: string;
  mobile?: string;
  payment_method: string;
  entry_date?: string;
  entry_time?: string;
}

export interface GetReportQueryDto {
  type?: string;
  groupBy?: string;
}
