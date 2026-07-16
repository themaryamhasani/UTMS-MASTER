import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';

type CapturedRpcRequest = {
  service: string;
  method: string;
  args: unknown[];
  context: string;
};

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = canonicalize((value as Record<string, unknown>)[key]);
    return result;
  }, {});
}

function logicalRpcKey(request: CapturedRpcRequest): string {
  return JSON.stringify(canonicalize(request));
}

test.describe('Domain RPC network deduplication', () => {
  test.use({ storageState: roleStatePath('DEVELOPER') });

  test('does not send duplicate logical read RPCs during authenticated route loads', async ({ page }) => {
    const requests: CapturedRpcRequest[] = [];

    page.on('request', request => {
      if (!request.url().includes('/api/domain/rpc')) return;

      const body = request.postDataJSON() as { service?: string; method?: string; args?: unknown[] } | null;
      if (!body?.service || !body.method) return;

      requests.push({
        service: body.service,
        method: body.method,
        args: Array.isArray(body.args) ? body.args : [],
        context: request.headers()['x-utms-context'] || '',
      });
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /داشبورد/ })).toBeVisible();
    await page.getByRole('button', { name: 'درخواست‌های تست' }).click();
    await expect(page.getByRole('heading', { name: 'کارتابل درخواست‌های تست' })).toBeVisible();
    await page.waitForTimeout(750);

    const counts = new Map<string, number>();
    requests.forEach(request => {
      const key = logicalRpcKey(request);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const duplicates = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ count, request: JSON.parse(key) }));
    expect(duplicates).toEqual([]);
    expect(requests.filter(request =>
      request.service === 'applicationApi' && request.method === 'getAll'
    )).toEqual([]);
  });
});
