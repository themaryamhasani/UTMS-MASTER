# Domain RPC API

Source-verified: 2026-07-22

The domain RPC bridge lets the React service interfaces execute inside the API process while the monolith is decomposed into backend modules. It is a transitional internal API, not a public REST contract.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/domain/health` | Returns bridge status and registered service names. |
| `GET` | `/api/domain/services` | Returns registered services and their callable methods. Loading this endpoint bundles the transitional services. |
| `POST` | `/api/domain/rpc` | Executes one service method. |

Request shape:

```json
{
  "service": "testRequestApi",
  "method": "getAll",
  "args": ["ALL", { "page": 1, "limit": 20 }]
}
```

Successful response shape:

```json
{
  "data": {}
}
```

Errors use the API server error envelope and an appropriate HTTP status. Unknown services or methods return `404`; invalid payloads and domain rules normally return `400`-class responses.

## Registered Services

The bridge registers:

- `testRequestApi`, `requirementApi`, `flowApi`, `testCaseApi` and `testRunApi`
- `bugApi`, `retestTaskApi`, `runIssueApi` and `checklistApi`
- `playwrightApi`, `releasePublishApi` and `versionHistoryApi`
- `commandTraceApi`, `auditLogApi`, `commentApi`, `notificationApi` and `attachmentApi`
- `dashboardApi`, `reportsApi` and `securityChecklistApi`
- `userApi`, `applicationApi`, `workflowPolicyApi` and `systemSettingsApi`

`GET /api/domain/services` is the runtime method inventory and should be used when exact method discovery is needed.

## Storage Routing

| Service | Storage path |
| --- | --- |
| `userApi` | Dedicated Prisma/PostgreSQL adapter |
| `applicationApi` | Dedicated Prisma/PostgreSQL adapter |
| `workflowPolicyApi` | Dedicated Prisma/PostgreSQL adapter |
| All other registered services | Bundled transitional implementation from `apps/web/src/services`; server state is saved to `UTMS_DOMAIN_STATE_FILE` or `runtime/domain-rpc/utms-state.json` |

The Prisma schema defines tables for the wider system, but merely having a model does not make that service PostgreSQL-backed.

## Browser Client Modes

`apps/web/src/services/domainRpcClient.ts` controls routing:

| `VITE_DOMAIN_API_MODE` | Behavior |
| --- | --- |
| `backend` | Default. Call the backend; fall back locally after any backend error for eligible services. Availability failures also open a short fallback circuit. |
| `strict` | Call the backend and surface failures; no fallback circuit. |
| `mock` | Execute eligible local service methods in the browser. Database-only services still require the backend. |

`applicationApi`, `userApi` and `workflowPolicyApi` are database-only. The browser adds a base64-encoded `x-utms-context` header from the persisted active context.

Optional client tuning variables:

- `VITE_DOMAIN_API_BASE_URL`, default `/api/domain`
- `VITE_DOMAIN_RPC_FALLBACK_COOLDOWN_MS`, default `5000`
- `VITE_DOMAIN_RPC_READ_CACHE_TTL_MS`, default `750`

## Query Handling

Known read operations are listed explicitly in both client and server policy sets.

- The browser deduplicates concurrent identical reads and caches responses for the configured short TTL.
- Context is part of the request fingerprint, preventing cross-context cache reuse.
- Mutations clear the browser read cache.
- The server deduplicates eligible concurrent calls, caps tracked entries and evicts stale entries.
- After a non-query transitional method, the server flushes the current domain state to disk.

## Security Boundary

The bridge accepts active context from a request header and does not currently validate a signed session or token. Scope and workflow checks inside the service layer are useful domain safeguards, but this endpoint is not yet a production authorization boundary.

In default `backend` mode, eligible calls also fall back to local execution after `4xx`/domain errors, not only when the backend is unavailable. Use `strict` when backend authorization/errors must never be bypassed by the development fallback.

Before production exposure:

1. Authenticate requests through signed session/JWT middleware.
2. Derive actor and scope server-side instead of trusting `x-utms-context`.
3. Add method-level authorization at the API boundary.
4. Replace bundled frontend services with backend-owned modules and Prisma repositories.
5. Version or replace the generic RPC contract with stable public APIs where needed.

The current API Dockerfile copies `apps/api` and shared packages but not `apps/web/src`, which is the source of the transitional dynamic bundle. Consequently, non-PostgreSQL RPC service loading is not self-contained in that image. This must be corrected by producing a backend-owned build artifact or dedicated modules; relying on browser fallback is not a deployment architecture.

## Source Map

- Client proxy: `apps/web/src/services/domainRpcClient.ts`
- Domain services: `apps/web/src/services/api.ts`
- Report read models: `apps/web/src/services/reportsApi.ts`
- Server dispatcher: `apps/api/src/modules/domain-rpc/domain-rpc-server.cjs`
- PostgreSQL adapters: `apps/api/src/modules/domain-rpc/postgres-*-service.cjs`
- HTTP host: `apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs`
