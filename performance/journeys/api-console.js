import http from 'k6/http';
import { jsonHeaders } from '../helpers/auth.js';
import { expectStatus, parseJson, requireField } from '../helpers/checks.js';
import { requireId } from '../helpers/correlation.js';
import { operationTags, think } from '../helpers/context.js';
import { collectionPayload, curlPayload, requestPayload } from '../helpers/data-factory.js';
import {
  api_console_execute_duration,
  download_duration,
  entities_created,
  entity_create_duration,
  entity_update_duration,
  execution_requests,
  files_downloaded,
} from '../helpers/metrics.js';

export function listCollections(config) {
  const tags = operationTags('api_console_list', 'api_console', { role: config.role });
  const response = http.get(`${config.baseUrl}/api/api-console/collections?applicationId=${encodeURIComponent(config.appId)}`, {
    headers: jsonHeaders(config),
    tags,
  });
  expectStatus(response, 200, tags);
  return parseJson(response);
}

export function createCollection(config) {
  const tags = operationTags('api_console_create_collection', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.post(`${config.baseUrl}/api/api-console/collections`, JSON.stringify(collectionPayload(config)), {
    headers: jsonHeaders(config),
    tags,
  });
  entity_create_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  const body = parseJson(response);
  requireId(body, tags);
  entities_created.add(1, tags);
  return body;
}

export function parseCurl(config) {
  const tags = operationTags('api_console_parse_curl', 'api_console', { role: config.role });
  const response = http.post(`${config.baseUrl}/api/api-console/curl/parse`, JSON.stringify(curlPayload()), {
    headers: jsonHeaders(config),
    tags,
  });
  expectStatus(response, 200, tags);
  const body = parseJson(response);
  requireField(body, 'normalizedRequest', tags);
  return body;
}

export function createRequest(config, collection, parsed) {
  const tags = operationTags('api_console_create_request', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.post(`${config.baseUrl}/api/api-console/requests`, JSON.stringify(requestPayload(config, collection, parsed)), {
    headers: jsonHeaders(config),
    tags,
  });
  entity_create_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  const body = parseJson(response);
  requireId(body, tags);
  entities_created.add(1, tags);
  return body;
}

export function readRequest(config, requestId) {
  const tags = operationTags('api_console_read_request', 'api_console', { role: config.role });
  const response = http.get(`${config.baseUrl}/api/api-console/requests/${encodeURIComponent(requestId)}`, {
    headers: jsonHeaders(config),
    tags,
  });
  expectStatus(response, 200, tags);
  return parseJson(response);
}

export function updateRequest(config, requestId) {
  const tags = operationTags('api_console_update_request', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.put(`${config.baseUrl}/api/api-console/requests/${encodeURIComponent(requestId)}`, JSON.stringify({
    description: `performance update ${config.runId}`,
  }), {
    headers: jsonHeaders(config),
    tags,
  });
  entity_update_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  return parseJson(response);
}

export function exportCurl(config, requestId) {
  const tags = operationTags('api_console_export_curl', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.post(`${config.baseUrl}/api/api-console/requests/${encodeURIComponent(requestId)}/export-curl`, JSON.stringify({ dialect: 'bash' }), {
    headers: jsonHeaders(config),
    tags,
  });
  download_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  files_downloaded.add(1, tags);
  return parseJson(response);
}

export function documentationPreview(config, requestId) {
  const tags = operationTags('api_console_documentation_preview', 'api_console', { role: config.role });
  const response = http.post(`${config.baseUrl}/api/api-console/requests/${encodeURIComponent(requestId)}/documentation/preview`, JSON.stringify({}), {
    headers: jsonHeaders(config),
    tags,
  });
  expectStatus(response, 200, tags);
  return parseJson(response);
}

export function executeBlockedRequest(config, requestId) {
  const tags = operationTags('api_console_execute', 'api_console', { role: config.role });
  const started = Date.now();
  const response = http.post(`${config.baseUrl}/api/api-console/requests/${encodeURIComponent(requestId)}/execute`, JSON.stringify({
    environmentId: 'env-test',
    runnerId: 'runner-performance',
  }), {
    headers: jsonHeaders(config),
    tags,
    timeout: '15s',
  });
  api_console_execute_duration.add(Date.now() - started, tags);
  expectStatus(response, 200, tags);
  execution_requests.add(1, tags);
  return parseJson(response);
}

export function apiConsoleLifecycle(config, options = {}) {
  listCollections(config);
  think(config);
  const collection = createCollection(config);
  think(config);
  const parsed = parseCurl(config);
  const request = createRequest(config, collection, parsed);
  readRequest(config, request.id);
  if (options.includeWrites !== false) updateRequest(config, request.id);
  if (options.includeExport !== false) exportCurl(config, request.id);
  if (options.includeDocumentation) documentationPreview(config, request.id);
  if (options.includeExecution) executeBlockedRequest(config, request.id);
  return { collection, request };
}
