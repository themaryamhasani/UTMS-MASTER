# ADR 0001 - Transitional Adapters During Monorepo Migration

Status reviewed: 2026-07-22 — accepted and still active. The domain-RPC service bundle and API Console CommonJS server remain transitional adapters; dedicated PostgreSQL adapters now exist for users, applications and workflow policies.

## Status

Accepted

## Context

The repository started as a Vite frontend plus a single CommonJS API Console server. The requested target architecture requires separate apps, packages, infrastructure, scripts, tests, and categorized documentation. A full domain rewrite of the large frontend service and API Console server would be a separate business implementation effort.

## Decision

The migration keeps two transitional adapters:

- `apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs`
- `apps/web/src/services/api.ts`

Both are moved into proper ownership boundaries and tracked in `docs/migration/LEGACY_COMPONENT_TRACKER.md`.

## Consequences

- Existing behavior is preserved during the structural migration.
- The final repository has executable workspace and architecture checks.
- The API Console and frontend in-memory service still need domain-level decomposition before production hardening is complete.
