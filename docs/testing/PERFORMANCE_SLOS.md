# Performance SLOs

No formal UTMS production SLOs were found in the repository. The k6 thresholds are provisional and configurable.

| Objective | Default |
| --- | ---: |
| HTTP failure rate, normal profiles | `< 1%` |
| Business success rate, normal profiles | `> 98%` |
| Health p95 | `< 300 ms` |
| API Console list p95 | `< PERF_P95_BUDGET`, default `1500 ms` |
| Domain report p95 | `< PERF_P95_BUDGET`, default `1500 ms` |
| Overall p99 | `< PERF_P99_BUDGET`, default `3000 ms` |
| Data integrity failure rate | `0` |
| Dropped iterations | `0` for safe normal profiles |

Stress and breakpoint profiles use degradation thresholds and are not PR gates.
