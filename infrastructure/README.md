# Infrastructure

Infrastructure files live under `infrastructure/`.

What belongs here:

- Dockerfiles per app.
- Compose files for infrastructure, development, and tests.
- Nginx, observability, and storage configuration.

What does not belong here:

- Application source.
- Runtime uploads or generated reports.
- Secrets or local environment files.

Build contexts must stay explicit and minimal. Production images should be multi-stage and run as a non-root user when implemented.

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
