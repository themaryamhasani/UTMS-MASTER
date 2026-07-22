# UTMS k6 Performance Harness

Source-verified: 2026-07-22

This directory contains the k6-based performance engineering harness for the UTMS monorepo.

## Pinned Tooling

- k6 Docker image: `grafana/k6:0.54.0`
- Local runner fallback: installed `k6` binary when available
- Performance stack: `infrastructure/compose/docker-compose.performance.yml`

## Safe Local Commands

```bash
npm run perf:stack:up
npm run perf:stack:wait
npm run perf:smoke
npm run perf:baseline
npm run perf:load
npm run perf:spike
npm run perf:soak
npm run perf:scalability
npm run perf:recovery
npm run perf:stack:down
```

`npm run perf:all:safe` runs smoke, baseline, load, spike, soak, scalability and recovery with their bounded defaults. It excludes stress and breakpoint capacity tests, which require an explicit destructive-test flag.

## Heavy Profiles

```bash
PERF_ALLOW_DESTRUCTIVE_TESTS=true PERF_ALLOW_WRITES=true npm run perf:stress
PERF_ALLOW_DESTRUCTIVE_TESTS=true PERF_ALLOW_WRITES=true npm run perf:breakpoint
```

Do not run heavy profiles against shared, production, public, or uncontrolled infrastructure.

## Outputs

Each run writes under `artifacts/performance/<run-id>/`:

- `summary.json`
- `summary.md`
- `summary-export.json`
- optional `PERFORMANCE_RESULTS.md`
- regression comparison output when `perf:compare` is used

## Real Coverage Boundary

The measured HTTP backend in this checkout is the Online API Console plus the domain-RPC bridge. User, application and workflow-policy RPC methods have PostgreSQL adapters, but the current k6 journeys do not establish relational capacity for all domain models. Redis, the worker and distributed queues are not exercised.

See [Performance execution guide](../docs/testing/PERFORMANCE_EXECUTION_GUIDE.md), [strategy](../docs/testing/PERFORMANCE_TEST_STRATEGY.md) and the dated [results](../docs/testing/PERFORMANCE_RESULTS.md).
