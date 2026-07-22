# Infrastructure

Source-verified: 2026-07-22

Infrastructure files live under `infrastructure/`.

What belongs here:

- Dockerfiles per app.
- Compose files for infrastructure, development, and tests.
- Nginx, observability, and storage configuration.

What does not belong here:

- Application source.
- Runtime uploads or generated reports.
- Secrets or local environment files.

Build contexts stay explicit. Current application images use Node.js 22 Alpine and run as the non-root `node` user. They are development/runtime foundations, not optimized multi-stage production images.

## Compose

Use the root `docker-compose.yml` for the normal local system:

```bash
docker compose up --build
```

The infrastructure-only and development compose files remain under `infrastructure/compose/` for targeted workflows:

```bash
docker compose -f infrastructure/compose/docker-compose.infrastructure.yml up
docker compose -f infrastructure/compose/docker-compose.development.yml up --build
```

Additional isolated stacks:

- `infrastructure/compose/docker-compose.test.yml`: PostgreSQL `15432`, Redis `16379`, API `14174`, web `15173`, plus the Playwright QA service.
- `infrastructure/compose/docker-compose.performance.yml`: isolated performance dependencies, downstream fixture, API `24174`, web `25173` and k6.

The default stack provisions PostgreSQL and Redis for the API, but Redis is not consumed by current application workflows. Worker and product-runner services require the `jobs` and `runner` profiles. Runtime API Console state is stored in a named volume; transitional `runtime/domain-rpc` state is not mounted and is lost when the API container is replaced.

The current API image does not copy `apps/web/src`, which the transitional domain-RPC dispatcher uses to create non-PostgreSQL services dynamically. Those services are therefore not self-contained in the image. This is tracked as `GAP-IMAGE-001`; users, applications and workflow policies use dedicated adapters and do not depend on that bundle.

See [Current Implementation](../docs/architecture/CURRENT_IMPLEMENTATION.md) for runtime maturity and persistence boundaries.
