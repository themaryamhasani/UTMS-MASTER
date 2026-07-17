import { check } from 'k6';
import {
  authentication_failure_rate,
  authorization_failure_rate,
  business_success_rate,
  data_integrity_failure_rate,
  server_error_rate,
  validation_failure_rate,
} from './metrics.js';

export function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export function expectStatus(response, status, tags = {}) {
  const ok = check(response, {
    [`${tags.operation || 'request'} status ${status}`]: r => r.status === status,
    [`${tags.operation || 'request'} json response`]: r => String(r.headers['Content-Type'] || '').includes('application/json'),
  }, tags);
  business_success_rate.add(ok, tags);
  authentication_failure_rate.add(response.status === 401, tags);
  authorization_failure_rate.add(response.status === 403, tags);
  validation_failure_rate.add(response.status === 400 || response.status === 422, tags);
  server_error_rate.add(response.status >= 500, tags);
  return ok;
}

export function requireField(value, field, tags = {}) {
  const ok = value && Object.prototype.hasOwnProperty.call(value, field);
  check(value, { [`${tags.operation || 'payload'} has ${field}`]: () => ok }, tags);
  data_integrity_failure_rate.add(!ok, tags);
  return ok;
}
