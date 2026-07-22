# Performance Workload Model

Source-verified against `performance/config/workloads.js`: 2026-07-22

No production traffic data exists in this checkout, so this is a provisional model.

| Workflow | Share | Rationale |
| --- | ---: | --- |
| Health and readiness | 15% | Frequent probes and recovery checks |
| Reports/domain read models | 20% | Dashboard/report read behavior |
| API Console list/context reads | 40% | Typical user navigation and filtering |
| API Console lifecycle writes | 25% | Collection/request creation, cURL parsing, update, export, sampled documentation |

## Executors

| Profile | Executor | Reason |
| --- | --- | --- |
| smoke | `constant-vus` | Validate scripts and safety with 1-2 users |
| baseline | `shared-iterations` | Sequential low-concurrency latency evidence |
| load | `ramping-arrival-rate` | Maintain target arrival rate under normal traffic |
| stress | `ramping-arrival-rate` | Increase pressure until degradation |
| spike | `ramping-arrival-rate` | Sudden burst and return |
| soak | `constant-arrival-rate` | Stable long-duration leakage check |
| scalability | `ramping-arrival-rate` | 1x, 2x, 3x, 5x comparison |
| recovery | `ramping-arrival-rate` | Overload and post-load health observation |
| breakpoint | `ramping-arrival-rate` | Capacity-oriented increasing arrival rate |

## Defaults

Default safe local settings are intentionally small: 1-2 VUs, 1 minute, low arrival rate, isolated run IDs, deterministic context headers, and test-store reset where allowed.
