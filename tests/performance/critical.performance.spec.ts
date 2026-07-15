import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/utms.fixture';
import { contextHeader } from '../helpers/api-context';
import { summarize, type PerformanceSample } from '../helpers/performance';
import { annotateTest, metadata } from '../helpers/traceability';

test('UTMS-PERF-CTM-001 @performance @classification-tree records API latency baseline', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-PERF-CTM-001', {
    requirement: 'Performance classification tree: API route × authenticated role × warm request', feature: 'API health', level: 'integration',
    type: 'performance', technique: 'Classification Tree Method', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'medium',
    data: '10 bounded GET /api/health samples', expected: 'Median, p90, p95, maximum, and failure rate are recorded as JSON',
  }));
  const samples: PerformanceSample[] = [];
  for (let index = 0; index < 10; index += 1) {
    const started = performance.now();
    const response = await api.get('/api/health', { headers: { 'x-utms-context': contextHeader('DEVELOPER') } });
    samples.push({ name: `health-${index + 1}`, durationMs: Math.round((performance.now() - started) * 100) / 100, status: response.status() });
    expect(response.status()).toBe(200);
  }
  const summary = summarize(samples);
  const budget = Number(process.env.UTMS_PERF_P95_MS || 1000);
  expect(summary.p95Ms).toBeLessThanOrEqual(budget);
  const output = path.resolve('artifacts/tests/performance/api-health.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ seed: process.env.UTMS_TEST_SEED || '20260715', samples, summary }, null, 2));
  await testInfo.attach('performance-json', { path: output, contentType: 'application/json' });
});

