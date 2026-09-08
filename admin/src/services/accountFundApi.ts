import api from "./api";

export type AccountFundType = "income" | "expense";

export interface AccountCategoryItem {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AccountFundItem {
  id: number;
  type: AccountFundType;
  name: string;
  sortOrder: number;
  isActive: boolean;
  categories: AccountCategoryItem[];
}

export interface AccountOptions {
  incomeFunds: Array<{ name: string; categories: string[] }>;
  expenseGroups: Array<{ name: string; categories: string[] }>;
  paymentMethods: string[];
}

export const accountOptionsApi = {
  get: () => api.get<AccountOptions>("/accounts/options"),
};

export const accountFundApi = {
  list: (type?: AccountFundType) =>
    api.get<AccountFundItem[]>("/accounts/funds", { params: type ? { type } : {} }),
  create: (payload: { type: AccountFundType; name: string }) => api.post("/accounts/funds", payload),
  update: (id: number, payload: { name?: string; sort_order?: number; is_active?: boolean }) =>
    api.patch(`/accounts/funds/${id}`, payload),
  remove: (id: number) => api.delete(`/accounts/funds/${id}`),
  createCategory: (fundId: number, payload: { name: string }) =>
    api.post(`/accounts/funds/${fundId}/categories`, payload),
  updateCategory: (id: number, payload: { name?: string; sort_order?: number; is_active?: boolean }) =>
    api.patch(`/accounts/categories/${id}`, payload),
  removeCategory: (id: number) => api.delete(`/accounts/categories/${id}`),
};
