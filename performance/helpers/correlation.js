import { requireField } from './checks.js';

export function requireId(payload, tags) {
  if (!requireField(payload, 'id', tags)) {
    throw new Error(`Missing correlated id for ${tags.operation || 'operation'}`);
  }
  return payload.id;
}
