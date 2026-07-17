import { sleep } from 'k6';

export function think(config) {
  const min = config.thinkTimeMin || 0;
  const max = Math.max(config.thinkTimeMax || min, min);
  sleep(min + Math.random() * (max - min));
}

export function operationTags(operation, endpointGroup, extra = {}) {
  return { operation, endpoint_group: endpointGroup, ...extra };
}
