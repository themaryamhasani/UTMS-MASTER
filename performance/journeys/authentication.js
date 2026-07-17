import http from 'k6/http';
import { auth_duration } from '../helpers/metrics.js';
import { jsonHeaders } from '../helpers/auth.js';
import { expectStatus, parseJson, requireField } from '../helpers/checks.js';
import { operationTags } from '../helpers/context.js';

export function contextRetrieval(config) {
  const tags = operationTags('context_retrieval', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.get(`${config.baseUrl}/api/api-console/policy`, { headers: jsonHeaders(config), tags });
  auth_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  const body = parseJson(response);
  requireField(body, 'canView', tags);
  return body;
}
