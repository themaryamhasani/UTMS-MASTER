# Tests

Cross-cutting test suites live under `tests/`.

What belongs here:

- Contract tests shared across apps and packages.
- Performance tests.
- Smoke tests.

Unit tests should live close to the source they cover. API integration, E2E, and security tests belong under `apps/api/test`. Worker and runner tests belong under their app test folders.

Shared fixtures and fakes belong in `packages/test-support`, not production packages.
