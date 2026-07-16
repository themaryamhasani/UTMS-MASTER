import { expect, test } from '@playwright/test';
import domainRpcModule from '../../apps/api/src/modules/domain-rpc/domain-rpc-server.cjs';

const domainRpc = domainRpcModule as unknown as {
  __testing: {
    isQueryOperation: (service: string, method: string) => boolean;
    allowsSingleFlightOperation: (service: string, method: string) => boolean;
    normalizeForFingerprint: (value: unknown) => unknown;
    buildQueryFingerprint: (
      req: { headers: Record<string, string> },
      service: string,
      method: string,
      args: unknown[]
    ) => string;
  };
};

function encodedContext(context: unknown): string {
  return Buffer.from(JSON.stringify(context), 'utf8').toString('base64');
}

test('Domain RPC policy deduplicates only explicit read operations', () => {
  expect(domainRpc.__testing.isQueryOperation('testRequestApi', 'getVisibleForRole')).toBe(true);
  expect(domainRpc.__testing.isQueryOperation('reportsApi', 'getTraceabilityReport')).toBe(true);
  expect(domainRpc.__testing.isQueryOperation('testRequestApi', 'create')).toBe(false);
  expect(domainRpc.__testing.isQueryOperation('bugApi', 'markReadyForRetest')).toBe(false);
  expect(domainRpc.__testing.isQueryOperation('unknownService', 'getAll')).toBe(false);
  expect(domainRpc.__testing.isQueryOperation('dashboardApi', 'getStats')).toBe(false);
  expect(domainRpc.__testing.allowsSingleFlightOperation('dashboardApi', 'getStats')).toBe(true);
  expect(domainRpc.__testing.allowsSingleFlightOperation('testRequestApi', 'create')).toBe(false);
});

test('Domain RPC fingerprint is deterministic and security-context aware', () => {
  const left = domainRpc.__testing.buildQueryFingerprint(
    {
      headers: {
        'x-utms-context': encodedContext({
          userId: 'user-1',
          role: 'QA_LEAD',
          applicationId: 'app-1',
          scope: 'SYSTEMS',
          scopeApplicationIds: ['app-2', 'app-1'],
        }),
      },
    },
    'testRequestApi',
    'getVisibleForRole',
    [{ limit: 10, page: 1, nested: { b: 2, a: 1 } }]
  );
  const right = domainRpc.__testing.buildQueryFingerprint(
    {
      headers: {
        'x-utms-context': encodedContext({
          userId: 'user-1',
          role: 'QA_LEAD',
          applicationId: 'app-1',
          scope: 'SYSTEMS',
          scopeApplicationIds: ['app-2', 'app-1'],
        }),
      },
    },
    'testRequestApi',
    'getVisibleForRole',
    [{ nested: { a: 1, b: 2 }, page: 1, limit: 10 }]
  );
  const otherUser = domainRpc.__testing.buildQueryFingerprint(
    {
      headers: {
        'x-utms-context': encodedContext({
          userId: 'user-2',
          role: 'QA_LEAD',
          applicationId: 'app-1',
          scope: 'SYSTEMS',
          scopeApplicationIds: ['app-2', 'app-1'],
        }),
      },
    },
    'testRequestApi',
    'getVisibleForRole',
    [{ nested: { a: 1, b: 2 }, page: 1, limit: 10 }]
  );

  expect(left).toBe(right);
  expect(left).not.toBe(otherUser);
});

test('Domain RPC fingerprint rejects unsupported argument values', () => {
  expect(() => domainRpc.__testing.normalizeForFingerprint({ valid: true, missing: undefined }))
    .toThrow(/Unsupported RPC argument value/);
});
