export interface ReportResponse {
  success: boolean;
  data: unknown[];
  message?: string;
  warning?: string;
}

export interface OptionalQueryResult<T = any> {
  rows: T[];
  warning?: string;
}
