import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('k6 Docker fallback is writable and preserves successful exit status', () => {
  const repositoryRoot = path.resolve(__dirname, '../..');
  const launcher = fs.readFileSync(
    path.join(repositoryRoot, 'performance/scripts/run-k6.cjs'),
    'utf8'
  );

  expect(launcher).toContain("spawnSync('/bin/sh', ['-c', 'command -v \"$1\"");
  expect(launcher).toContain("['--user', `${process.getuid()}:${process.getgid()}`]");
  expect(launcher).toMatch(/run\('docker',[\s\S]+?process\.exit\(0\);/);
});
