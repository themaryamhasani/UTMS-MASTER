# Tests

Source-verified: 2026-07-22

Cross-cutting Playwright Test suites live under this directory. The root
configuration defines separate projects for structural, smoke, E2E, system,
accessibility, compatibility, performance, reliability, regression, and UAT
evidence. API integration and security specs live under `apps/api/test` and
share the same fixtures and traceability helpers.

```text
tests/
  accessibility/ compatibility/ e2e/ performance/ regression/
  reliability/ smoke/ structural/ system/ uat/
  data/ fixtures/ helpers/
```

Every test carries a stable `UTMS-...` ID and ISO 29119-4 metadata. See
`docs/testing/PLAYWRIGHT_TEST_STRATEGY.md` for isolation, Docker, browser, and
artifact conventions. Shared builders and generators belong in
`packages/test-support`, not production packages.

Playwright starts local API/web processes unless `PLAYWRIGHT_SKIP_WEBSERVER=1`. The default URLs are `http://127.0.0.1:4174` and `http://127.0.0.1:5173`; the isolated Compose stack uses `14174` and `15173`.

The committed CI workflow runs smoke, API integration, security, structural, E2E, system, accessibility, compatibility, bounded performance, reliability, regression and UAT projects. `npm run verify` does not run these Playwright projects.
