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
