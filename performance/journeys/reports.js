import http from 'k6/http';
import { report_generation_duration, reports_generated } from '../helpers/metrics.js';
import { jsonHeaders } from '../helpers/auth.js';
import { expectStatus, parseJson, requireField } from '../helpers/checks.js';
import { operationTags } from '../helpers/context.js';

export function domainSystemOverview(config) {
  const tags = operationTags('domain_report', 'domain_rpc', { role: config.role });
  const started = Date.now();
  const response = http.post(`${config.baseUrl}/api/domain/rpc`, JSON.stringify({
    service: 'reportsApi',
    method: 'getSystemOverview',
    args: ['ALL'],
  }), { headers: jsonHeaders(config), tags });
  report_generation_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  const body = parseJson(response);
  requireField(body, 'data', tags);
  reports_generated.add(1, tags);
  return body;
}

export function apiUsageReport(config) {
  const tags = operationTags('api_usage_report', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.get(`${config.baseUrl}/api/api-console/reports/api-usage`, {
    headers: jsonHeaders(config),
    tags,
  });
  report_generation_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  return parseJson(response);
}
