# Performance Bottlenecks

## Confirmed From Architecture

| Area | Evidence | Risk |
| --- | --- | --- |
| API Console persistence | `api-console-server.cjs` uses file-backed store under runtime data directory | Concurrent write throughput is likely limited by JSON file serialization |
| Reports/domain RPC | Domain RPC runs server-side web service/read-model code | Report latency is not PostgreSQL-backed and may be CPU/serialization bound |
| PostgreSQL/Redis | Compose provisions services, but current measured business flows do not use them as persistence/cache dependencies | Do not claim DB/Redis bottlenecks until backend repositories/queues are wired |

## Required Evidence Before Optimization

Do not optimize based on speculation. For each change, capture before/after p95, p99, throughput, error rate, memory, and any file-store or event-loop metrics.

## Implemented Optimizations

None. No k6 execution evidence was available locally, so no application performance optimization was applied.

## Current Safe-Run Signals

- The safe scalability run reached `PERF_MAX_VUS=10` and recorded 3 dropped iterations while still passing the configured threshold. This suggests the next controlled run should raise `PERF_MAX_VUS` before treating the 5x step as a system saturation result.
- API RSS p95 rose from about 74 MB in smoke/load to about 80 MB in scalability/recovery. This short run is not long enough to prove or disprove a memory leak.
- The observed p95 values remained under the provisional budgets in all safe profiles, so no evidence-backed application optimization was applied.
