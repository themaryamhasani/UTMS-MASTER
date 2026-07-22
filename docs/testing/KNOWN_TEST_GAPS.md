# Known Test Gaps

Source-verified: 2026-07-22

These are explicit limitations of the current product implementation. They are not silently skipped and are not counted as passing coverage.

| Gap ID | Evidence | Impact | Planned resolution |
| --- | --- | --- | --- |
| GAP-DB-001 | The Prisma schema covers the product, but only users, applications and workflow policies have dedicated PostgreSQL RPC adapters. Other domains use transitional API-process/file state or browser persistence. | No PostgreSQL transaction or relational-integrity claim for requests, requirements, tests, bugs, releases, reports or API Console runtime data. | Implement the remaining Prisma repositories and isolated database integration suites. |
| GAP-REDIS-001 | Worker and Redis are foundations in this checkout and are not called by the tested web domains. | Queue, retry, and distributed-lock behavior is unavailable. | Integrate worker jobs and add dependency-failure/recovery suites. |
| GAP-API-001 | Domain services and reports are callable through generic `POST /api/domain/rpc`; the resource-style REST endpoints in workflow documents are not implemented. | The internal RPC bridge is not a stable, versioned public API contract. | Replace or version RPC with backend-owned APIs and add route/authorization contract suites. |
| GAP-IMAGE-001 | `infrastructure/docker/api/Dockerfile` does not copy `apps/web/src`, while the transitional domain-RPC dispatcher bundles services from that path at runtime. | Non-PostgreSQL RPC services are not self-contained in the API image and eligible browser calls may fall back locally. | Build backend-owned service artifacts into the API image or replace the transitional bundle with dedicated modules, then add an image-level domain-services assertion. |
| GAP-HARNESS-001 | On 2026-07-22, `npm run test:structural` failed during module loading because the root Playwright/CommonJS context imported `apps/web/src/services/domainRpcClient.ts`, whose `import.meta.env` was parsed outside an ES module. | No structural assertions execute in the current harness, even though earlier evidence exists. | Make the structural import path ESM-safe or inject domain-RPC configuration without `import.meta`, then rerun and republish the matrix. |
| GAP-DOCX-001 | Documentation finalization endpoint returns a product artifact only for supported request states. | DOCX binary conformance is not asserted until a stable fixture is available. | Add a fixture-backed ZIP/DOCX validator to the API integration suite. |
| GAP-ENGINE-001 | Firefox and WebKit binaries may not be installed on developer machines. | Compatibility rows remain `PENDING-ENV` until `npx playwright install firefox webkit` succeeds. | Install pinned browsers in CI and publish all three project results. |
| GAP-PERF-001 | Playwright samples are local request/page measurements, not high-volume load testing. | No unsupported throughput/SLA claim. | Run a dedicated load tool against an isolated environment for capacity evidence. |
| GAP-SSRF-001 | DNS rebinding and redirect-to-private-address checks require a controllable DNS/transport double. | Current tests cover deterministic loopback, metadata, file, and encoded-address policy decisions only. | Add an isolated transport adapter and DNS fixture without weakening production policy. |
| GAP-A11Y-001 | Axe is automated; full screen-reader, braille, and manual WCAG user testing are outside Playwright. | Automated serious/critical scan is not a complete conformance claim. | Schedule manual assistive-technology review for each release. |
| GAP-FEATURE-001 | Several PRD areas (attachments, comments, notifications, audit UI, full release workflow) are frontend simulations or partial pages. | Only visible behavior that exists is tested; missing behavior is not fabricated. | Close product implementation gaps and add requirement-based journeys. |

Every `fixme`, skip, or pending compatibility result must reference one of these IDs in the test or report. No broad retry or unconditional skip is used to hide a failure.
