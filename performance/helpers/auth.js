import encoding from 'k6/encoding';
import { contextFor } from '../config/test-data.js';

export function contextHeader(role, config, overrides = {}) {
  return encoding.b64encode(JSON.stringify(contextFor(role, config, overrides)), 'std', 's');
}

export function jsonHeaders(config, role = config.role, overrides = {}) {
  return {
    'content-type': 'application/json',
    'x-utms-context': contextHeader(role, config, overrides),
  };
}
