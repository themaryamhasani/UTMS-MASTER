import http from 'k6/http';

export function resetTestStore(config) {
  if (!['local', 'test', 'performance', 'ci'].includes(String(config.environment).toLowerCase())) return;
  http.post(`${config.baseUrl}/api/api-console/__test/reset`, null, {
    tags: { operation: 'test_reset', endpoint_group: 'api_console' },
  });
}
