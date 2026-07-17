# Performance Results

## Local Safe k6 Run

Executed on 2026-07-17 with k6 `v0.54.0` against a local `NODE_ENV=test` API process on `http://127.0.0.1:4317`.

The dedicated Docker performance stack was attempted first, but Docker Hub returned `403 Forbidden` while pulling `postgres:16-alpine`. The run therefore used the pinned Windows k6 binary and a local isolated API data directory.

Configuration:

- `PERF_ROLE=QA_LEAD`
- `PERF_DURATION=12s`
- `PERF_RAMP_DURATION=4s`
- `PERF_RATE=1`
- `PERF_PEAK_RATE=3`
- `PERF_MAX_VUS=10`
- `PERF_ALLOW_WRITES=true`

| Profile | Run ID | HTTP requests | Throughput req/s | p50 ms | p90 ms | p95 ms | p99 ms | HTTP error rate | Checks | Dropped iterations | Thresholds |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| smoke | `smoke-2026-07-17T13-49-17-961Z` | 47 | 3.77 | 2.35 | 212.95 | 215.59 | 625.41 | 0% | 100% | 0 | passed |
| baseline | `baseline-2026-07-17T13-49-32-124Z` | 144 | 33.09 | 0.87 | 204.39 | 210.30 | 215.46 | 0% | 100% | 0 | passed |
| load | `load-2026-07-17T13-49-38-015Z` | 42 | 2.00 | 1.50 | 206.18 | 208.34 | 211.77 | 0% | 100% | 0 | passed |
| spike | `spike-2026-07-17T13-50-00-648Z` | 226 | 5.92 | 2.64 | 8.86 | 203.51 | 216.55 | 0% | 100% | 0 | passed |
| short soak | `soak-2026-07-17T13-50-40-257Z` | 47 | 3.79 | 1.95 | 5.66 | 6.83 | 7.85 | 0% | 100% | 0 | passed |
| scalability | `scalability-2026-07-17T13-50-54-167Z` | 524 | 7.65 | 2.53 | 9.71 | 202.90 | 214.83 | 0% | 100% | 3 | passed with capacity warning |
| recovery | `recovery-2026-07-17T13-52-04-126Z` | 307 | 9.40 | 1.13 | 6.32 | 10.51 | 217.31 | 0% | 100% | 0 | passed |

## Resource Observations

| Profile | API RSS p95 bytes | API heap p95 bytes | Event-loop p95 ms |
| --- | ---: | ---: | ---: |
| smoke | 73,897,779 | 8,324,161 | 35.39 |
| baseline | 73,142,272 | 8,575,256 | 33.47 |
| load | 73,211,085 | 8,569,082 | 33.81 |
| spike | 73,912,320 | 8,966,845 | 33.66 |
| short soak | 75,791,565 | 9,846,776 | 33.01 |
| scalability | 80,147,251 | 11,280,450 | 32.87 |
| recovery | 80,426,598 | 12,088,698 | 32.63 |

## Findings

- All executed safe k6 profiles passed configured thresholds.
- Scalability reached the configured `PERF_MAX_VUS=10` and logged an insufficient-VUs warning with 3 dropped iterations. The configured scalability threshold allows fewer than 10 dropped iterations, so this is a capacity signal rather than a failed run.
- API Console execution p95 was measured only where sampled: scalability `911 ms`, recovery `683.6 ms`.
- No PostgreSQL, Redis, worker, or queue performance claim is made for these business transactions.

## Artifacts

Each run contains `summary.json`, `summary.md`, `summary-export.json`, and `PERFORMANCE_RESULTS.md` under `artifacts/performance/<run-id>/`.
