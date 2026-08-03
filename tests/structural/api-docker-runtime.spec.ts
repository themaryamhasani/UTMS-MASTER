import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('API Docker image contains the transitional Domain RPC service source', () => {
  const repositoryRoot = path.resolve(__dirname, '../..');
  const dockerfile = fs.readFileSync(
    path.join(repositoryRoot, 'infrastructure/docker/api/Dockerfile'),
    'utf8'
  );
  const domainRpcServer = fs.readFileSync(
    path.join(repositoryRoot, 'apps/api/src/modules/domain-rpc/domain-rpc-server.cjs'),
    'utf8'
  );

  expect(domainRpcServer).toContain("'apps', 'web', 'src', 'services', 'api.ts'");
  expect(dockerfile).toMatch(/COPY\s+--chown=node:node\s+apps\/web\s+apps\/web/);
});
