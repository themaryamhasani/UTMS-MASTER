import { uniqueName } from '../config/test-data.js';

export function collectionPayload(config) {
  return {
    name: uniqueName(config, 'perf-collection'),
    applicationId: config.appId,
  };
}

export function curlPayload() {
  return {
    curlText: "curl https://example.com/perf/orders -H 'accept: application/json' --data-raw '{\"id\":1}'",
  };
}

export function requestPayload(config, collection, parsed) {
  return {
    name: uniqueName(config, 'perf-request'),
    applicationId: config.appId,
    collectionId: collection.id,
    environmentId: 'env-test',
    normalizedRequest: parsed.normalizedRequest,
    importedCurlId: parsed.id,
  };
}
