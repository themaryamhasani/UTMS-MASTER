# Tests

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
