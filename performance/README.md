# UTMS k6 Performance Harness

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

`npm run perf:all:safe` runs only safe bounded profiles. It excludes destructive stress, extended soak, and breakpoint capacity tests.

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

The measured HTTP backend in this checkout is the Online API Console plus the domain-RPC bridge. PostgreSQL and Redis are included in compose because the stack provisions them, but current measured business operations do not claim database, Redis, worker, or distributed queue performance unless a future transaction actually uses those dependencies.
