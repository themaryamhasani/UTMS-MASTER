# API Modules

Source-verified: 2026-07-22

API modules are bounded contexts for backend behavior. Each module owns its domain rules, application commands and queries, infrastructure adapters, and presentation endpoints.

What belongs here:

- Domain entities, policies, value objects, events, and repository contracts.
- Application command/query handlers and DTOs.
- Infrastructure implementations for persistence, queueing, external services, and transitional adapters.
- Thin presentation adapters such as HTTP controllers.

What does not belong here:

- Frontend code.
- Worker or Playwright runner implementation.
- Shared test fixtures.
- Runtime data files.

Dependency direction is presentation to application to domain. Infrastructure may implement domain or application ports, but domain code must not import framework, persistence, queue, filesystem, or environment-specific modules.

## Current Modules

- `api-console`: the HTTP host and Online API Console transitional CommonJS implementation. It also mounts health, reports-prefix and domain-RPC handling.
- `domain-rpc`: an internal RPC dispatcher, query single-flight policy and dedicated PostgreSQL adapters for users, applications and workflow policies.

For services without a PostgreSQL adapter, domain RPC currently generates an esbuild bundle from `apps/web/src/services` beneath `runtime/domain-rpc`. This exception exists to preserve behavior during migration and should shrink as backend-owned modules are implemented. See [Domain RPC API](../../../../docs/api/DOMAIN_RPC_API.md).
