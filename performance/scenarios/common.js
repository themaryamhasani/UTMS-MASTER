import { group } from 'k6';
import { assertSafeTarget, loadEnvironment, redactedConfig } from '../config/environments.js';
import { thresholdsFor } from '../config/thresholds.js';
import { scenariosFor } from '../config/workloads.js';
import { resetTestStore } from '../helpers/cleanup.js';
import { redact } from '../helpers/redaction.js';
import { think } from '../helpers/context.js';
import { contextRetrieval } from '../journeys/authentication.js';
import { apiConsoleLifecycle, listCollections } from '../journeys/api-console.js';
import { domainHealth, health, performanceMetrics } from '../journeys/health.js';
import { apiUsageReport, domainSystemOverview } from '../journeys/reports.js';
import { recovery_duration, recovery_failure_rate } from '../helpers/metrics.js';

export function buildOptions(profile, overrides = {}) {
  const config = loadEnvironment(profile);
  assertSafeTarget(config, overrides.safety || { requiresWrites: true });
  return {
    scenarios: scenariosFor(config, profile),
    thresholds: thresholdsFor(config, profile),
    summaryTrendStats: ['min', 'med', 'avg', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
    userAgent: `utms-k6/${profile}`,
    noConnectionReuse: false,
    setupTimeout: '60s',
    teardownTimeout: '60s',
  };
}

export function setupProfile(profile, overrides = {}) {
  const config = loadEnvironment(profile);
  assertSafeTarget(config, overrides.safety || { requiresWrites: true });
  console.log(`UTMS performance config: ${redact(redactedConfig(config))}`);
  if (overrides.reset !== false) resetTestStore(config);
  health(config);
  domainHealth(config);
  performanceMetrics(config);
  return config;
}

export function baselineWorkload(config) {
  group('health and context', () => {
    health(config);
    domainHealth(config);
    contextRetrieval(config);
  });
  group('read models', () => {
    domainSystemOverview(config);
    apiUsageReport(config);
  });
  group('api console read/list', () => {
    listCollections(config);
  });
  performanceMetrics(config);
}

export function apiConsoleWorkload(config) {
  const roll = Math.random();
  if (roll < 0.15) {
    group('health', () => health(config));
  } else if (roll < 0.35) {
    group('reports', () => {
      domainSystemOverview(config);
      if (Math.random() < 0.35) apiUsageReport(config);
    });
  } else if (roll < 0.75) {
    group('api console read/list', () => {
      contextRetrieval(config);
      listCollections(config);
    });
  } else {
    group('api console lifecycle', () => {
      apiConsoleLifecycle(config, {
        includeDocumentation: Math.random() < 0.2,
        includeExecution: Math.random() < 0.05,
      });
    });
  }
  if (__ITER % 10 === 0) performanceMetrics(config);
  think(config);
}

export function recoveryWorkload(config) {
  const started = Date.now();
  try {
    health(config);
    apiConsoleWorkload(config);
    health(config);
    recovery_failure_rate.add(false, { operation: 'recovery_probe', endpoint_group: 'health' });
  } catch (error) {
    recovery_failure_rate.add(true, { operation: 'recovery_probe', endpoint_group: 'health' });
    throw error;
  } finally {
    recovery_duration.add(Date.now() - started, { operation: 'recovery_probe', endpoint_group: 'health' });
  }
}

export function handleSummary(data) {
  const config = loadEnvironment(__ENV.PERF_PROFILE || 'summary');
  const prefix = `${config.outputDir}/`;
  return {
    stdout: `UTMS k6 ${config.profile} summary written to ${prefix}\n`,
    [`${prefix}summary.json`]: JSON.stringify(data, null, 2),
    [`${prefix}summary.md`]: markdownSummary(config, data),
  };
}

function metricLine(data, name) {
  const metric = data.metrics[name];
  if (!metric || !metric.values) return `| ${name} | n/a | n/a | n/a | n/a |`;
  const values = metric.values;
  return `| ${name} | ${values['p(50)'] ?? values.med ?? 'n/a'} | ${values['p(90)'] ?? 'n/a'} | ${values['p(95)'] ?? 'n/a'} | ${values['p(99)'] ?? 'n/a'} |`;
}

function markdownSummary(config, data) {
  const failedThresholds = Object.entries(data.metrics)
    .flatMap(([name, metric]) => Object.entries(metric.thresholds || {}).filter(([, result]) => !result.ok).map(([threshold]) => `${name}: ${threshold}`));
  return `# UTMS Performance Summary

- Run ID: ${config.runId}
- Profile: ${config.profile}
- Target: ${config.baseUrl}
- Environment: ${config.environment}
- k6 profile status: ${failedThresholds.length ? 'threshold failures' : 'thresholds passed'}

| Metric | p50 | p90 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
${[
  'http_req_duration',
  'http_req_duration{operation:health}',
  'http_req_duration{operation:api_console_list}',
  'http_req_duration{operation:domain_report}',
  'entity_create_duration',
  'report_generation_duration',
  'api_console_execute_duration',
].map(name => metricLine(data, name)).join('\n')}

## Threshold Failures

${failedThresholds.length ? failedThresholds.map(item => `- ${item}`).join('\n') : '- None recorded.'}
`;
}
