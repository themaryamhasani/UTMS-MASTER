# Performance Test Strategy

Source-verified against the k6 harness: 2026-07-22

UTMS performance testing uses k6 for protocol-level load generation and keeps Playwright as the existing functional/e2e evidence layer. The harness targets implemented local surfaces only: `/api/health`, `/api/domain/*`, and `/api/api-console/*`.

## Architecture

| Layer | Tool | Purpose | Automation |
| --- | --- | --- | --- |
| Protocol performance | k6 `grafana/k6:0.54.0` | Load, baseline, spike, soak, scalability, recovery | `performance/scenarios` |
| Frontend performance | k6 browser, optional | Small browser journey only | `performance/scenarios/frontend` |
| Infrastructure snapshots | API `/api/__perf/metrics`, Docker stats where available | CPU/memory/process observation | performance-only/test-only |
| Functional correctness | Existing Playwright suites | Product behavior and security correctness | existing `tests` and `apps/api/test` |

## Safety

The harness refuses production-like targets, requires `PERF_ENVIRONMENT`, and requires `PERF_ALLOW_WRITES=true` for write profiles. Stress and breakpoint require `PERF_ALLOW_DESTRUCTIVE_TESTS=true`.

## Scope Boundary

PostgreSQL, Redis, worker and queue performance are not claimed for business flows that do not exercise those components. API Console persistence is file-backed. Domain RPC reports execute server-side transitional domain/read-model code, not a relational reporting backend; the existence of PostgreSQL adapters for users, applications and workflow policies does not extend that claim to all domains.
