export interface CreateIncomeRequestDto {
  amount: number | string;
  receipt_no?: string;
  fund: string;
  category: string;
  donor_name: string;
  address?: string;
  mobile?: string;
  payment_method: string;
  note?: string;
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
  note?: string;
  entry_date?: string;
  entry_time?: string;
}

export interface GetReportQueryDto {
  type?: string;
  groupBy?: string;
}

export interface ListAccountsQueryDto {
  type?: string;
  fund?: string;
  category?: string;
  from?: string;
  to?: string;
}

export interface UpdateAccountRequestDto {
  amount?: number | string;
  receipt_no?: string;
  voucher_no?: string;
  fund?: string;
  category?: string;
  donor_name?: string;
  receiver_name?: string;
  address?: string;
  mobile?: string;
  payment_method?: string;
  note?: string;
  entry_date?: string;
  entry_time?: string;
}

export interface CreateFundRequestDto {
  type: "income" | "expense";
  name: string;
}

export interface UpdateFundRequestDto {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateCategoryRequestDto {
  name: string;
}

export interface UpdateCategoryRequestDto {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}
