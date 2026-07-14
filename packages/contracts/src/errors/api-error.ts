export interface ApiErrorContract {
  category: string;
  message: string;
  correlationId?: string;
}
