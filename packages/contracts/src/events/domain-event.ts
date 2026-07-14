export interface DomainEventContract<TPayload extends object = Record<string, unknown>> {
  id: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
}
