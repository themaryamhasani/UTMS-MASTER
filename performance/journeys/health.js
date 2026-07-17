import http from 'k6/http';
import { Trend } from 'k6/metrics';
import { expectStatus, parseJson, requireField } from '../helpers/checks.js';
import { operationTags } from '../helpers/context.js';

export const infra_memory_rss = new Trend('infra_memory_rss');
export const infra_heap_used = new Trend('infra_heap_used');
export const infra_event_loop_p95 = new Trend('infra_event_loop_p95');

export function health(config) {
  const tags = operationTags('health', 'health');
  const response = http.get(`${config.baseUrl}/api/health`, { tags });
  expectStatus(response, 200, tags);
  const body = parseJson(response);
  requireField(body, 'status', tags);
  return body;
}

export function domainHealth(config) {
  const tags = operationTags('domain_health', 'domain_rpc');
  const response = http.get(`${config.baseUrl}/api/domain/health`, { tags });
  expectStatus(response, 200, tags);
  return parseJson(response);
}

export function performanceMetrics(config) {
  const tags = operationTags('perf_metrics', 'metrics');
  const response = http.get(`${config.baseUrl}/api/__perf/metrics`, { tags });
  if (response.status !== 200 && response.status !== 404) {
    expectStatus(response, 200, tags);
    return null;
  }
  if (response.status === 404) return null;
  const body = parseJson(response);
  if (body && body.memory) {
    infra_memory_rss.add(body.memory.rssBytes, tags);
    infra_heap_used.add(body.memory.heapUsedBytes, tags);
  }
  if (body && body.eventLoop) {
    infra_event_loop_p95.add(body.eventLoop.p95Ms, tags);
  }
  return body;
}
