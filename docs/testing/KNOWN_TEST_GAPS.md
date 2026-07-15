# Known Test Gaps

These are explicit limitations of the current product implementation. They are not silently skipped and are not counted as passing coverage.

| Gap ID | Evidence | Impact | Planned resolution |
| --- | --- | --- | --- |
| GAP-DB-001 | `apps/web/src/services/api.ts` uses module-memory/browser persistence for most UTMS domains; the API server currently implements Online API Console routes. | No claim of PostgreSQL integration or relational integrity for dashboard, requests, requirements, bugs, releases, or reports. | Complete the domain API adapters and Prisma repositories, then add isolated database integration suites. |
| GAP-REDIS-001 | Worker and Redis are foundations in this checkout and are not called by the tested web domains. | Queue, retry, and distributed-lock behavior is unavailable. | Integrate worker jobs and add dependency-failure/recovery suites. |
| GAP-API-001 | API route inventory covers implemented Online API Console routes; reports routes outside that module are not implemented in the HTTP server. | No backend contract claim for unimplemented reports or general UTMS REST endpoints. | Implement and document the domain API surface before adding route assertions. |
| GAP-DOCX-001 | Documentation finalization endpoint returns a product artifact only for supported request states. | DOCX binary conformance is not asserted until a stable fixture is available. | Add a fixture-backed ZIP/DOCX validator to the API integration suite. |
| GAP-ENGINE-001 | Firefox and WebKit binaries may not be installed on developer machines. | Compatibility rows remain `PENDING-ENV` until `npx playwright install firefox webkit` succeeds. | Install pinned browsers in CI and publish all three project results. |
| GAP-PERF-001 | Playwright samples are local request/page measurements, not high-volume load testing. | No unsupported throughput/SLA claim. | Run a dedicated load tool against an isolated environment for capacity evidence. |
| GAP-SSRF-001 | DNS rebinding and redirect-to-private-address checks require a controllable DNS/transport double. | Current tests cover deterministic loopback, metadata, file, and encoded-address policy decisions only. | Add an isolated transport adapter and DNS fixture without weakening production policy. |
| GAP-A11Y-001 | Axe is automated; full screen-reader, braille, and manual WCAG user testing are outside Playwright. | Automated serious/critical scan is not a complete conformance claim. | Schedule manual assistive-technology review for each release. |
| GAP-FEATURE-001 | Several PRD areas (attachments, comments, notifications, audit UI, full release workflow) are frontend simulations or partial pages. | Only visible behavior that exists is tested; missing behavior is not fabricated. | Close product implementation gaps and add requirement-based journeys. |

Every `fixme`, skip, or pending compatibility result must reference one of these IDs in the test or report. No broad retry or unconditional skip is used to hide a failure.

