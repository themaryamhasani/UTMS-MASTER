# Performance Capacity Report

Evidence status reviewed: 2026-07-22

No maximum sustainable throughput is reported yet.

The breakpoint/capacity profile exists at `performance/scenarios/breakpoint/breakpoint.js`, but it is intentionally guarded by:

```bash
PERF_ALLOW_DESTRUCTIVE_TESTS=true
```

The local safe scalability run reached a 5x configured arrival step and produced 7.65 aggregate HTTP req/s with 0% HTTP failures, but it also reached `PERF_MAX_VUS=10` and dropped 3 iterations. That is not a breakpoint result and must not be treated as maximum capacity.

Current safe-run capacity signal:

- Highest safe measured aggregate throughput: 9.40 HTTP req/s in the recovery profile.
- Highest step-model profile: scalability, 7.65 HTTP req/s, 0% HTTP errors, 3 dropped iterations.
- Breakpoint/capacity profile: not run.
