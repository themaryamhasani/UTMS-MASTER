# Shared Package

Source-verified: 2026-07-22

`packages/shared` contains framework-independent utilities that are used by more than one app or package.

Allowed examples include generic result types, date-time helpers, identifier utilities, and secret redaction helpers.

Do not put feature-specific business logic, backend framework code, frontend components, test fixtures, or environment access in this package.

## Current Exports

- Clock/date-time abstraction.
- Correlation-ID generation.
- Secret redaction.
- Generic result/validation helpers.
- Prisma client access through the `@utms/shared/database` subpath.

The database subpath is infrastructure support and reads `DATABASE_URL`; the package's default export remains framework-independent utilities.
