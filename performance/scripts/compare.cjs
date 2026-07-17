const fs = require('node:fs');
const path = require('node:path');

const baseline = process.argv[2];
const current = process.argv[3];
const tolerancePercent = Number(process.env.PERF_REGRESSION_TOLERANCE_PERCENT || 15);
const minimumSamples = Number(process.env.PERF_REGRESSION_MIN_SAMPLES || 20);

if (!baseline || !current) {
  console.error('Usage: node performance/scripts/compare.cjs <baseline-summary.json> <current-summary.json>');
  process.exit(1);
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function metric(data, name, stat) {
  const values = data.metrics?.[name]?.values || data.metrics?.[name];
  return values?.[stat] ?? null;
}

function classify(base, now) {
  if (base === null || now === null || base === 0) return 'insufficient-data';
  const change = ((now - base) / base) * 100;
  if (change <= -tolerancePercent) return 'improved';
  if (change <= tolerancePercent) return 'unchanged';
  if (change <= tolerancePercent * 2) return 'warning-regression';
  return 'critical-regression';
}

const base = read(baseline);
const now = read(current);
const metrics = ['http_req_duration', 'entity_create_duration', 'report_generation_duration', 'api_console_execute_duration'];
const rows = [];
let critical = false;
for (const name of metrics) {
  const values = now.metrics?.[name]?.values || now.metrics?.[name] || {};
  const count = values.count ?? 0;
  for (const stat of ['p(50)', 'p(90)', 'p(95)', 'p(99)']) {
    const result = count < minimumSamples ? 'insufficient-samples' : classify(metric(base, name, stat), metric(now, name, stat));
    if (result === 'critical-regression') critical = true;
    rows.push({ metric: name, stat, baseline: metric(base, name, stat), current: metric(now, name, stat), result });
  }
}

const output = {
  tolerancePercent,
  minimumSamples,
  comparedAt: new Date().toISOString(),
  rows,
};
const outputFile = path.join(path.dirname(current), 'regression-comparison.json');
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
console.log(outputFile);
if (critical) process.exit(2);
