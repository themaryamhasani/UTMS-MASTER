const fs = require('node:fs');
const path = require('node:path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function value(metric, key) {
  return metric && metric.values && metric.values[key] !== undefined ? metric.values[key] : null;
}

function status(data) {
  const failures = [];
  for (const [name, metric] of Object.entries(data.metrics || {})) {
    for (const [threshold, result] of Object.entries(metric.thresholds || {})) {
      if (!result.ok) failures.push(`${name}: ${threshold}`);
    }
  }
  return failures;
}

const runDir = process.argv[2] || process.env.PERF_OUTPUT_DIR;
if (!runDir) {
  console.error('Usage: node performance/scripts/report.cjs <artifacts/performance/run-id>');
  process.exit(1);
}
const summaryFile = path.join(runDir, 'summary-export.json');
const fallbackFile = path.join(runDir, 'summary.json');
const data = fs.existsSync(fallbackFile) ? readJson(fallbackFile) : readJson(summaryFile);
const failures = status(data);
const rows = ['http_req_duration', 'entity_create_duration', 'report_generation_duration', 'api_console_execute_duration']
  .map(name => {
    const metric = data.metrics[name];
    return `| ${name} | ${value(metric, 'p(50)') ?? 'n/a'} | ${value(metric, 'p(90)') ?? 'n/a'} | ${value(metric, 'p(95)') ?? 'n/a'} | ${value(metric, 'p(99)') ?? 'n/a'} |`;
  });
const markdown = `# UTMS Performance Result

| Metric | p50 | p90 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
${rows.join('\n')}

## Thresholds

${failures.length ? failures.map(item => `- FAILED ${item}`).join('\n') : '- All recorded thresholds passed.'}
`;
fs.writeFileSync(path.join(runDir, 'PERFORMANCE_RESULTS.md'), markdown);
console.log(path.join(runDir, 'PERFORMANCE_RESULTS.md'));
