import type { APIRequestContext } from '@playwright/test';

export async function resetIsolatedStore(api: APIRequestContext): Promise<void> {
  const response = await api.post('/api/api-console/__test/reset');
  if (!response.ok()) throw new Error(`Isolated reset failed with HTTP ${response.status()}`);
}

