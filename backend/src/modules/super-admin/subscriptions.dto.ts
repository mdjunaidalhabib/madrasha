export interface SubscriptionPurchaseDto {
  plan_id?: number | string;
  start_date?: string;
  custom_amount?: number | string;
  payment_method?: string;
  transaction_id?: string;
}
