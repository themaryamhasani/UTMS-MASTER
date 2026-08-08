# Scripts

Source-verified: 2026-08-08

Permanent scripts live under `scripts/` and must work from the repository root.

What belongs here:

- Development orchestration.
- Database operations.
- Migration utilities.
- Test and performance orchestration.
- Verification and CI checks.

What does not belong here:

- Application source code.
- One-off temporary scripts.
- Scripts that print secrets.

Scripts should validate inputs, return non-zero on failure, and keep output concise.

## Current Commands

| Directory | Scripts | Root entry points |
| --- | --- | --- |
| `development` | Preflights ports, prepares Redis/CouchDB, and starts web, API, snapshot worker and runner together | `npm run dev:all` |
| `database` | Prisma generate/deploy/status/seed and relational verification | `npm run db:*` |
| `testing` | Isolated Compose lifecycle, suite orchestration, repetition and compatibility | `npm run test:stack:*`, `test:all`, `test:repeat`, `test:compatibility`, `test:docker` |
| `verification` | Formatting, lint, architecture and contract assertions | `npm run format:check`, `lint`, `architecture:check`, `test:contract` |

The k6-specific orchestrators live under `performance/scripts` because they own that harness rather than general repository automation.

## Windows Development Dependencies

`dev:all` reuses configured Redis and CouchDB services. If Redis is absent, it
first tries the embedded development runtime and then falls back to the Compose
`redis` service. A native Apache CouchDB installation is supported by setting
`COUCHDB_URL`, `COUCHDB_DATABASE`, `COUCHDB_USERNAME`, `COUCHDB_PASSWORD`, and
`UTMS_DEV_COUCHDB=external` in ignored `.env`.

The launcher invokes the installed `npm-cli.js` directly on Windows. This is
required when it is started as a hidden/background Node process because
spawning `npm.cmd` directly with `shell: false` otherwise fails with `EINVAL`.
