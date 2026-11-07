export interface DomainSubscriptionDto {
  domain?: string;
  amountPaid?: number | string;
  startDate?: string;
  endDate?: string;
  isActive?: 0 | 1;
  registeredInNameOf?: "institution" | "platform";
}
