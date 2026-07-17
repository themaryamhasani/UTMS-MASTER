# Performance Execution Guide

## Local Isolated Stack

```bash
npm run perf:stack:up
npm run perf:stack:wait
PERF_ENVIRONMENT=performance PERF_BASE_URL=http://localhost:24174 PERF_WEB_URL=http://localhost:25173 PERF_ALLOW_WRITES=true npm run perf:smoke
```

## Existing Test Stack

```bash
npm run test:stack:up
npm run test:stack:wait
PERF_ENVIRONMENT=local PERF_BASE_URL=http://localhost:14174 PERF_WEB_URL=http://localhost:15173 PERF_ALLOW_WRITES=true npm run perf:baseline
```

## Heavy Manual Profiles

```bash
PERF_ENVIRONMENT=performance PERF_BASE_URL=http://localhost:24174 PERF_ALLOW_WRITES=true PERF_ALLOW_DESTRUCTIVE_TESTS=true npm run perf:stress
PERF_ENVIRONMENT=performance PERF_BASE_URL=http://localhost:24174 PERF_ALLOW_WRITES=true PERF_ALLOW_DESTRUCTIVE_TESTS=true npm run perf:breakpoint
```

## Reports

```bash
npm run perf:report -- artifacts/performance/<run-id>
npm run perf:compare -- artifacts/performance/baseline/summary-export.json artifacts/performance/current/summary-export.json
```

## Required Environment Variables

Key variables: `PERF_BASE_URL`, `PERF_WEB_URL`, `PERF_ENVIRONMENT`, `PERF_PROFILE`, `PERF_RUN_ID`, `PERF_SEED`, `PERF_VUS`, `PERF_RATE`, `PERF_DURATION`, `PERF_P95_BUDGET`, `PERF_P99_BUDGET`, `PERF_ALLOW_WRITES`, `PERF_ALLOW_DESTRUCTIVE_TESTS`, and `PERF_OUTPUT_DIR`.
