# Scripts

Source-verified: 2026-07-22

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
| `development` | Starts web, API and optional foundation processes together | `npm run dev:all` |
| `database` | Prisma generate/deploy/status/seed and relational verification | `npm run db:*` |
| `testing` | Isolated Compose lifecycle, suite orchestration, repetition and compatibility | `npm run test:stack:*`, `test:all`, `test:repeat`, `test:compatibility`, `test:docker` |
| `verification` | Formatting, lint, architecture and contract assertions | `npm run format:check`, `lint`, `architecture:check`, `test:contract` |

The k6-specific orchestrators live under `performance/scripts` because they own that harness rather than general repository automation.
