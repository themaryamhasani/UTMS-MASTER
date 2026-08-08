# Live CDE and Playwright Implementation Record

Source-verified: 2026-08-08

This is the canonical implementation and handoff document for the live Raya
CDE integration and the product Playwright execution pipeline. It records what
was learned from the live browser traffic and supplied response samples, what
is implemented in this checkout, what has been verified locally, and what
still needs operational configuration or live smoke testing.

When this document conflicts with older CDE URL-discovery or placeholder-runner
documents, this document describes the current implementation.

## 1. Executive Status

| Capability | Status | Important qualification |
| --- | --- | --- |
| UTMS server-side login/session | Implemented | PostgreSQL `UserSession`, opaque HttpOnly cookie, CSRF token |
| CDE account connection | Implemented | Separate from UTMS login; CDE cookies are encrypted server-side |
| Core transport | Implemented and contract-tested | Every outbound Core request is POST to one of two fixed endpoints |
| Live CDE project discovery | Implemented | Reads `cde/repository/list/my-repo` directly; no UTMS mapping required |
| Live Web UI/Data Service/API Module source browsing | Implemented | Repository names are derived from the selected accessible project |
| Message Consumer browsing | Implemented against the corresponding provider contract | A missing/unsupported repository is reported independently in the catalog |
| Branch discovery and source normalization | Implemented | One branch is automatic; multiple branches require selection |
| Administrator-managed Application mapping | Implemented | Required for managed test files, snapshots, and runs, not ordinary browsing |
| CouchDB-backed Playwright file reads/writes | Implemented | Every document is bound to one exact UTMS Application/CDE project mapping |
| Immutable source snapshots | Implemented | Encrypted object storage, manifest and hashes, 24-hour source retention |
| BullMQ snapshot worker | Implemented | Uses the initiating user's still-valid UTMS/CDE session |
| Real Playwright runner | Implemented | Runs Playwright 1.55.1 from encrypted snapshots and uploads artifacts |
| Local `dev:all` orchestration | Implemented | Starts or reuses Redis, checks ports, and launches all four runtimes |
| CouchDB service | Implemented in Compose, native/external mode, and API adapter | `dev:all` reuses a configured service or starts the local Compose service |
| Live CDE/CouchDB/run smoke | Not performed by the implementing agent | Requires Docker/CouchDB, a dedicated CDE account, mapping, and environment |
| Local mapping/environment data | Requires administrator setup | The database observation on 2026-08-08 found no CDE mapping for the selected Application |

## 2. Correct Mental Model

There are four distinct concepts. They must not be merged in future changes.

1. **UTMS authentication** proves who the user is inside UTMS and establishes
   their role and Application scope.
2. **CDE connection** establishes a separate authenticated browser-equivalent
   Core session for that UTMS session. It supplies project access but does not
   change UTMS authorization.
3. **Live source browsing** shows projects returned by the connected CDE
   account. It does not require an administrator-created UTMS Application
   mapping.
4. **Managed testing** stores Playwright files in UTMS CouchDB, binds every
   document to the mapped CDE project, snapshots that project plus the exact
   CouchDB revisions, and runs against a configured deployed environment. It
   requires a mapping and environment profile, but no writable CDE package.

The visible managed Applications are the intersection of:

- the user's UTMS Application scope;
- enabled `CdeApplicationMapping` rows; and
- projects returned by the connected CDE account's `my-repo` provider.

The live CDE project browser is deliberately broader: it uses the CDE account's
`my-repo` result directly. This separation fixed the earlier behavior where a
valid CDE project was invisible merely because no UTMS mapping existed.

## 3. What We Learned About Raya Core

### 3.1 Core is a two-gateway, POST-only provider system

Core does not expose one conventional REST URL per repository operation. The
provider name is carried inside a JSON body sent to one of two fixed endpoints.

| Logical operation | HTTP endpoint | Body shape |
| --- | --- | --- |
| Read/data-source provider | `POST https://cde.edus.ir/core-api/v1/data-provider/get-data-source` | `{ "serviceId": "cde.edus.ir", "key": "...", "params": {} }` |
| Form/write/login provider | `POST https://cde.edus.ir/core-api/v1/data-provider/store-form-data` | `{ "serviceId": "cde.edus.ir", "formId": "...", "data": {} }` |

Internal provider notation is translated before the HTTP request:

- `ds/cde/repository/list/my-repo` becomes
  `key: "cde/repository/list/my-repo"`;
- `fr/auth/signin/check-password` becomes
  `formId: "auth/signin/check-password"`;
- `ds/` and `fr/` never appear in the outbound Core body.

UTMS exposes normal local `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` routes to
its own browser client. A local UTMS `GET` does **not** mean an outbound GET to
Core. The API server translates it into the required Core POST.

### 3.2 Required request behavior

The adapter sends:

- `method: POST`;
- `Accept: */*`;
- `Content-Type: application/json; charset=UTF-8`;
- a stable `client-id` for the lifetime of the CDE connection;
- cookies from its server-side `tough-cookie` jar;
- `Origin: https://cde.edus.ir`;
- `Referer: https://cde.edus.ir/` for login providers;
- `Referer: https://cde.edus.ir/second-editor` for repository/package providers;
- no `prostage` header for the currently allowlisted login forms. The transport
  retains editor-form support, but no CDE write form is currently allowlisted.

The HTTP library generates `Content-Length`. Chromium `sec-*` headers and
Google Analytics cookies are intentionally not copied.

Requests time out after 60 seconds by default. Serialized requests and
responses are bounded to 32 MiB by default through `CDE_MAX_BODY_BYTES`, which
also accommodates large package-fetch responses. The historical browser save
observation is no longer an operation UTMS performs.

### 3.3 Provider allowlist

The adapter cannot proxy arbitrary provider names or URLs. Current reads are:

- `pages-app/who-am-i`;
- `cde/repository/list/my-repo`;
- `cde/repository/web-ui/list/fetch`;
- `cde/repository/data-service/list/fetch`;
- `cde/repository/api-module/list/fetch`;
- `cde/repository/message-consumer/list/fetch`;
- `cde/package/any/one/fetch`.

Current forms are login-only:

- `auth/signin/iran-cellphone`;
- `auth/signin/check-password`.

`cde/package/any/personal/save` was removed from the allowlist when Playwright
storage moved to CouchDB. UTMS no longer writes project or test source to CDE.

The two endpoint origins and paths are constants, so user input cannot select
another host.

### 3.4 HTTP 200 is not necessarily success

Core frequently returns HTTP 200 even when the provider operation failed. The
adapter rejects logical errors found in:

- top-level `error`;
- `Result.error`;
- `Result.success === false`;
- `Result.serverMessage.type` equal to `error` or `danger`.

Malformed JSON, oversized bodies, unsafe redirects, provider schema errors,
timeouts, and non-2xx responses are also converted to categorized UTMS errors.

### 3.5 `ecreq` compatibility

The CDE session remembers the latest `Result.ecreq` value. When it becomes
true, requests are AES-encrypted into `{ "reqtoken": "..." }` using the Core
client-id-derived secret. A Core response containing `token` is decrypted,
including the observed double-encoded JSON representation.

This protocol encryption is separate from encryption at rest of the cookie jar
and snapshots.

## 4. Authentication and Session Boundaries

### 4.1 UTMS session

UTMS login creates a PostgreSQL `UserSession` and sets an opaque
`utms_session` cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` in
production. Only a SHA-256 hash of the opaque token is stored in PostgreSQL.
The session fixes the active role, scope, permitted Application IDs, and role
assignment.

Mutations require an `x-csrf-token` derived from the opaque session token. In
production, authorization comes from this server session. The legacy
`x-utms-context` header is development/test compatibility and must not become a
production trust boundary.

Password hashes use Argon2id. If an old SHA-256 password hash is successfully
verified, it is replaced with Argon2id once as a compatibility migration.

### 4.2 CDE connection sequence

CDE connection is a second login flow inside an already-authenticated UTMS
session:

1. UTMS creates a fresh CDE state with a client ID and empty cookie jar.
2. It checks `pages-app/who-am-i` using `get-data-source`.
3. If not already logged in, it sends this through `store-form-data`:

   ```json
   {
     "serviceId": "cde.edus.ir",
     "formId": "auth/signin/iran-cellphone",
     "data": {
       "userSource": "rayadevelopers",
       "userLoginName": "<cellphone>"
     }
   }
   ```

4. UTMS returns a five-minute encrypted login challenge. The cellphone is not
   persisted in PostgreSQL or logs.
5. The password step sends:

   ```json
   {
     "serviceId": "cde.edus.ir",
     "formId": "auth/signin/check-password",
     "data": {
       "userSource": "rayadevelopers",
       "userLoginName": "<cellphone from challenge>",
       "contact": "iran-cellphone",
       "password": "<one-time submitted password>"
     }
   }
   ```

6. UTMS immediately calls `pages-app/who-am-i` again. Connection succeeds only
   when `Result.IsUserLogin` is true.

The password is forwarded once and is never persisted. Do not add CDE
credentials, cookies, copied request headers, or live client IDs to source,
fixtures, documentation, seed data, or environment files. A credential shared
during investigation must be rotated before live testing.

### 4.3 CDE state storage

The stable client ID, serialized cookie jar, `ecreq` state, timestamps, and
short project-list cache are encrypted with AES-256-GCM and stored in Redis at
a key bound to the UTMS `UserSession.id`. The default TTL is 12 hours.
Production requires a strong `CDE_SESSION_ENCRYPTION_KEY` and a functioning
Redis service. Development can fall back to an in-process memory store when
Redis is unavailable, but that fallback is not production durability.

If a protected Core call returns `IsUserLogin: false`, UTMS deletes the CDE
state and reports `CDE_RECONNECT_REQUIRED`. Disconnecting also deletes it.

## 5. Live Project and Source Loading

### 5.1 Project discovery

The source of truth is:

```json
{
  "serviceId": "cde.edus.ir",
  "key": "cde/repository/list/my-repo",
  "params": {}
}
```

`Result.items` is expected to be an array of project-key strings. UTMS removes
empty values and duplicates, caches the result in the encrypted CDE state for
60 seconds, and returns each project with server-derived repository names:

- `<project>/web-ui`;
- `<project>/data-service`;
- `<project>/api-module`;
- `<project>/message-consumer`.

Project keys are restricted to a safe identifier format. Every later package
request rechecks that the selected project appears in `my-repo`; the browser
cannot invent a project or repository name.

### 5.2 Direct project routes

| UTMS route | Authorization and Core behavior |
| --- | --- |
| `GET /api/cde/projects` | Requires UTMS and CDE sessions; Core POST `cde/repository/list/my-repo` |
| `GET /api/cde/projects/:projectKey/catalog` | Rechecks project access, then Core POSTs each allowlisted repository list provider |
| `POST /api/cde/projects/:projectKey/package` | Rechecks project and package membership, then loads the selected package/branch |

Catalog repository failures are isolated. For example, a project can still
show its Web UI packages when Message Consumer is absent; the failing
repository entry contains an error instead of failing the whole catalog.

### 5.3 Repository calls

For `medu-inquiry`, the correctly derived Web UI request is:

```json
{
  "serviceId": "cde.edus.ir",
  "key": "cde/repository/web-ui/list/fetch",
  "params": {
    "repoName": "medu-inquiry/web-ui"
  }
}
```

The supplied response listed `pages/component/medu-inquiry/App`. Opening it
uses:

```json
{
  "serviceId": "cde.edus.ir",
  "key": "cde/package/any/one/fetch",
  "params": {
    "repoName": "medu-inquiry/web-ui",
    "packId": "pages/component/medu-inquiry/App"
  }
}
```

The supplied package sample had one personal, read-only REACT branch with
`rand_id` `1r4hhryn2a2c5f`, `versionId` `msbj99sq6xm`, and 268 source entries.
Because it had one readable branch, UTMS should open it automatically and show
it read-only. These identifiers are response evidence, not configuration
defaults.

Data Service follows the same list-then-package-fetch pattern using
`<project>/data-service` and `dservice/package/...` IDs.

API Module is different: its list result already includes each module's
`public`/`personal` branches and `actions` source. UTMS first verifies that the
module ID is in the list response and then exposes `actions` as a synthetic
`.js` text file. It never calls `eval`, imports the module, or executes it.

### 5.4 Branch rules

Package branches are normalized as:

- `{ kind: "PUBLIC" }` for the public branch;
- `{ kind: "PERSONAL", randId, index }` for a personal branch.

Each branch carries its exact `versionId`, `editable` flag, and metadata.

- One readable branch: select automatically.
- More than one readable branch: return `409 BRANCH_SELECTION_REQUIRED` with
  the available selectors.
- Direct source browsing accepts the explicit selector for the current open.
- Application-mapped browsing can persist the selection per user,
  Application, repository type/name, and package.
- Public branches are always read-only.
- A branch is writable only when it is personal and Core says
  `editable: true`.

UTMS never guesses that the highest or most recent-looking version is correct.

### 5.5 File normalization and safety

Package files come from `branch.content.content[]` entries with `{name, code,
oppend}`. Virtual folders are derived from slashes in `name`.

Conceptual snapshot roots are:

- `web-ui/<package-id>/<file>`;
- `data-service/<package-id>/<file>`;
- `api-module/<module-id>/<branch>.js`;
- `message-consumer/<package-id>/<file>`;
- `tests/<file>`.

Source normalization rejects:

- absolute POSIX paths;
- Windows drive paths;
- `..` traversal;
- NUL characters;
- duplicate paths;
- case-insensitive path collisions.

All normal project source is read-only in UTMS.

## 6. Administrator Mapping and Environments

`CdeApplicationMapping` links one UTMS Application to:

- CDE project key;
- optional Web UI repository;
- optional Data Service repository;
- optional API Module repository;
- optional Message Consumer repository;
- enabled and validation state.

Only a System Administrator can create/update or validate a mapping. Repository
suffixes are validated. Mapping validation confirms that the connected CDE
account can see the project and that the configured CouchDB store is healthy.
The old nullable test-repository/package/branch columns remain only for database
compatibility and are cleared by new mapping writes.

`ApplicationEnvironment` stores named deployed targets with:

- Web base URL;
- optional API base URL;
- optional Gateway base URL;
- server-side secret references;
- enabled state.

Production URLs must be HTTPS and cannot include credentials or fragments.
Development may use HTTP. Tests run against this selected deployed environment;
UTMS does not start Raya Core locally for each run.

## 7. CouchDB-Backed Playwright Files

### 7.1 Authoritative document store

Playwright specs and helpers are authoritative in the private
`utms_playwright` CouchDB database. No writable CDE branch or package is
required. Each document contains:

- CouchDB `_id` and MVCC `_rev`;
- document type and schema version;
- UTMS `applicationId`;
- normalized `tests/...` path, script, description, and SHA-256 source hash;
- creator/updater and timestamps;
- exact `cdeBinding`: fixed CDE origin/service ID, project key, and mapped Web
  UI/Data Service/API Module/Message Consumer repositories;
- a SHA-256 `bindingFingerprint` of that CDE binding.

PostgreSQL `PlaywrightTestFile` remains an authorization/query index and source
cache. It stores the Couch document ID/revision and binding metadata, but
snapshots and writes always read authoritative content from CouchDB.

Legacy `MANAGED`, `DISCOVERED`, and previous `CDE` rows remain readable and are
never silently modified. Only `COUCHDB` rows are editable/runnable in the new
pipeline.

### 7.2 Read flow

`GET /api/applications/:id/playwright/files`:

1. checks the UTMS automated-test permission;
2. checks Application scope and enabled mapping;
3. confirms the connected CDE account can still access the mapped project;
4. queries CouchDB by Application, project key, and binding fingerprint;
5. rejects unsafe paths and duplicate/case-colliding documents;
6. normalizes/synchronizes Couch metadata into `PlaywrightTestFile`;
7. merges non-colliding legacy read-only rows;
8. returns pagination, folders, and CouchDB storage/binding information.

The earlier 404 was not a bad Core payload. The selected Application had no
enabled mapping, so the API correctly returned:

```json
{
  "error": {
    "category": "CDE_MAPPING_NOT_FOUND",
    "message": "This Application does not have an enabled CDE mapping."
  }
}
```

At the time, this response was 113 bytes. The UI incorrectly called the mapped
file route while only a direct CDE project was selected. It now keeps the live
CDE project selector separate and does not make that request unless a mapped
Application exists.

### 7.3 Write flow and optimistic concurrency

Creating or updating a test file performs this exact sequence:

1. Validate role, CSRF token, path, supported extension, non-empty source, and
   the two-MiB per-file limit.
2. Load the enabled mapping and confirm the CDE account still sees its project.
3. Build the canonical `cdeBinding` and fingerprint from the server-side
   mapping; the browser cannot provide or override them.
4. Acquire a 60-second Redis lock scoped to Application, binding, and
   case-folded target path to prevent duplicate-path races.
5. Check the complete bound Couch document set for path collisions.
6. For updates, refetch the document and require the submitted
   `expectedRevision` to equal its current `_rev`.
7. Create or update the Couch document. CouchDB performs its own MVCC conflict
   check as a second concurrency boundary.
8. Refetch the saved document and verify `_rev` and the SHA-256 content hash.
9. Synchronize the PostgreSQL metadata/cache row and create an audit record
   containing the document ID, revision, binding, and fingerprint.
10. Release the Redis lock in `finally`.

A stale `_rev`, concurrent path lock, CouchDB conflict, project-binding
mismatch, or failed post-save verification returns a 409-class conflict. Writes
are never automatically retried. No Core form/write request occurs in this
flow.

## 8. Persistence Added for This Integration

Migrations `20260803130000_live_cde_playwright` and
`20260808110000_couchdb_playwright_store` add or support the following runtime
records:

| Model | Purpose |
| --- | --- |
| `UserSession` | Opaque server session, active role/scope, token hash, expiry/revocation |
| `CdeApplicationMapping` | Administrator-controlled CDE project/repository mapping |
| `CdeBranchSelection` | Remembered exact branch per user/Application/repository/package |
| `ApplicationEnvironment` | Deployed Web/API/Gateway targets and secret references |
| `CdeSourceSnapshot` | Snapshot status, manifest, encrypted object key, hash, errors, expiry/purge state |
| `PlaywrightTestFile` Couch fields | Couch document ID/revision, exact CDE binding, remote path, hash, synchronization time |
| `PlaywrightRun` extended fields | Environment, snapshot, test file, queue/runner state, heartbeat, timing, counts, report, artifacts |

Authoritative test source is stored in CouchDB. PostgreSQL retains a synchronized
cache because the existing `PlaywrightTestFile.script` contract is non-null;
snapshot materialization never trusts that cache as its source of execution.
Source bodies are not copied into mapping or branch-selection tables.
Snapshot source is placed in encrypted private object storage and purged after
24 hours; the manifest and version/file hashes remain as evidence.

## 9. Snapshot and Runner Pipeline

### 9.1 Run creation

Creating a run requires:

- automated-test permission;
- an accessible mapped Application;
- a valid enabled environment profile;
- a synchronized CouchDB Playwright test file bound to that mapping;
- a connected CDE session;
- CSRF protection.

UTMS creates `CdeSourceSnapshot` and `PlaywrightRun` records transactionally.
The initial run state is `PREPARING`/`QUEUED`, and a job is added to
`utms-playwright-snapshots`. Timeout is bounded to 30-3600 seconds and retries
to 0-3.

### 9.2 Snapshot worker

Before queueing, UTMS records the complete sorted CouchDB document ID/revision/
hash set in the pending snapshot. The worker calls an internal token-protected
API endpoint. The API reloads the
initiating `UserSession`, accesses that session's encrypted CDE cookie jar, and
materializes:

- every configured project repository package;
- exactly one selected branch per package;
- all CouchDB Playwright documents with the exact mapping fingerprint;
- the selected deployed environment;
- a manifest of repo/package selectors, CDE versions, file paths, and hashes.

If any Couch document is added, removed, or revised while the snapshot waits,
materialization fails with `COUCHDB_SNAPSHOT_CONFLICT`; it never silently runs a
different test set. The bundle is content-hashed, encrypted, uploaded to private S3-compatible
storage, and marked `READY`. The initiating session ID is then removed from the
snapshot row and the run job is placed on `utms-playwright-runs`.

The worker also requests expired-snapshot purge periodically. Transient object
deletion failures are retried on a later cleanup pass.

### 9.3 Runner isolation and execution

The runner does not receive or call CDE and never receives the CDE cookie jar.
It receives only run/snapshot identifiers and reads the encrypted snapshot from
object storage.

The current runtime:

- verifies the snapshot content hash;
- creates a per-run temporary workspace;
- materializes source from the immutable bundle;
- makes project source files/directories read-only;
- uses the preinstalled Playwright 1.55.1 CLI and browser image;
- does not install dependencies from CDE at runtime;
- builds a validated argument array for `spawn` instead of a shell command
  template;
- drops the test process to an unprivileged UID/GID when the container starts
  as root;
- sets the selected environment URLs in the test environment;
- tracks heartbeats;
- observes Redis cancellation markers;
- terminates the process tree on cancellation or timeout;
- collects the real JSON report, logs, screenshots, video, traces, and other
  output files;
- encrypts and uploads artifacts;
- persists status, counts, report metadata, paths, duration, and logs;
- removes the temporary workspace in cleanup.

The intended deployment keeps Docker socket, database, Redis, object-store, and
API credentials out of the child test process. Container-level resource and
network policies must remain part of production deployment review.

## 10. Browser/API Surface

### 10.1 UTMS and CDE sessions

| Method and route | Purpose |
| --- | --- |
| `GET /api/cde/session` | Validate current CDE session using `who-am-i` |
| `POST /api/cde/session/start` | Cellphone step and encrypted challenge creation |
| `POST /api/cde/session/password` | Password step and post-login `who-am-i` confirmation |
| `DELETE /api/cde/session` | Delete the CDE state for this UTMS session |

### 10.2 Direct source browsing

| Method and route | Purpose |
| --- | --- |
| `GET /api/cde/projects` | All projects available to the connected CDE account |
| `GET /api/cde/projects/:projectKey/catalog` | Derived Web UI/Data Service/API Module/Message Consumer catalogs |
| `POST /api/cde/projects/:projectKey/package` | Exact package and branch source, read-only |

### 10.3 Mapped Application administration and source

| Method and route | Purpose |
| --- | --- |
| `GET/PUT /api/applications/:id/cde/mapping` | Read/administer a mapping |
| `POST /api/applications/:id/cde/mapping/validate` | Validate live CDE project access and CouchDB health |
| `GET /api/cde/applications` | Mapped Applications visible in both UTMS and CDE scopes |
| `GET /api/applications/:id/cde/catalog` | Mapped repository/test catalog |
| `POST /api/applications/:id/cde/package` | Load an exact mapped package branch |
| `PUT /api/applications/:id/cde/branch-selection` | Persist the exact selected branch |
| `GET/POST /api/applications/:id/playwright/files` | List or create CouchDB-backed test files |
| `PATCH /api/applications/:id/playwright/files/:fileId` | Update a CouchDB document with expected `_rev` |
| `GET/POST /api/applications/:id/environments` | List or create environment profiles |
| `PATCH /api/applications/:id/environments/:environmentId` | Update an environment profile |

### 10.4 Runs

| Method and route | Purpose |
| --- | --- |
| `GET/POST /api/playwright/runs` | List or create real runs |
| `GET /api/playwright/runs/:id` | Run, snapshot, environment, and result state |
| `POST /api/playwright/runs/:id/cancel` | Cancel queued or executing work |

Internal snapshot materialization/purge routes require
`UTMS_INTERNAL_JOB_TOKEN` and are not browser APIs.

## 11. Current UI Behavior

`apps/web/src/pages/PlaywrightFilesPage.tsx` now presents two distinct areas:

- **Live CDE project source:** select any `my-repo` project, inspect repository
  catalogs, select a package/branch when necessary, and view source read-only.
- **Mapped Playwright files:** select an administrator-mapped UTMS Application,
  view/edit the CouchDB tests bound to its exact CDE project, choose an
  environment, and run.

The page also shows UTMS login separately from CDE connection state, prompts
for reconnect, handles branch-selection conflicts, exposes exact version IDs,
marks legacy files as read-only, and refreshes after write conflicts.

The important regression guard is: selecting a direct CDE project must not
trigger `/api/applications/:id/playwright/files` unless that ID appears in
`GET /api/cde/applications`.

`apps/web/src/pages/ApplicationsPage.tsx` also uses the live
`GET /api/cde/projects` list. An administrator selects a project rather than
typing three unrelated editor URLs or a project key. Each server-generated
project descriptor contains canonical repository names and `editorUrls` for
Front, Data Service, and Gateway. The UI displays these values as read-only and
saves/validates the canonical `CdeApplicationMapping` with the Application.
Playwright source still lives in CouchDB; these links and repositories identify
the read-only CDE project to which the tests are bound.

## 12. Local Development and the Redis/Port Incident

The supported command is:

```powershell
npm.cmd run dev:all
```

`scripts/development/dev-all.cjs` now:

1. loads the repository `.env` when present;
2. checks Web port 5173 and API port 4174 before spawning anything;
3. reuses a reachable configured Redis;
4. otherwise tries an ephemeral `redis-memory-server` for local development;
5. places the Windows Memurai download/runtime beneath the ASCII-only OS temp
   directory, avoiding the license/path problem caused by the repository's
   non-ASCII parent path;
6. gives the embedded Redis a 64-MiB no-eviction limit by default;
7. falls back to the password-protected Compose Redis when the Windows Memurai
   runtime cannot start (for example, because its developer license is absent);
8. passes one stable `REDIS_URL` to Web, API, worker, and runner;
9. reuses a reachable CouchDB or starts the local Compose `couchdb` service;
10. starts `dev:web`, `dev:api`, `dev:worker`, and `dev:runner` with one stable
   CouchDB URL;
11. resolves `npm-cli.js` directly on Windows so background/direct Node startup
   does not fail with `spawn EINVAL`;
12. stops the complete Windows process trees with `taskkill /T /F` when one
   service exits or the launcher is interrupted.

The launcher deliberately fails when 5173 or 4174 is occupied. Vite should not
silently move the Web app to 5174, because that masks a stale process and can
send browser requests to a different API generation. If startup says a port is
occupied, stop the earlier `dev:all` process and retry.

The API uses plain `node src/main.cjs`, not a watch process. Restart
`dev:all` after changing API CJS files. Otherwise the browser can keep talking
to the old route table even though the source on disk is newer.

Direct `dev:worker` or `dev:runner` expects a reachable Redis and performs a
bounded preflight so connection failure is reported once rather than as an
endless `ECONNREFUSED 127.0.0.1:6379` loop.

CouchDB is persistent infrastructure, so `dev:all` does not stop its container
when the Node processes exit. If Docker is intentionally unavailable,
`UTMS_DEV_COUCHDB=optional` permits source-only development, but Playwright file
routes then return `COUCHDB_UNAVAILABLE`. An explicit `COUCHDB_URL` is treated
as externally managed and must already be reachable.

Native Apache CouchDB on Windows is supported. Configure its origin and a
dedicated service account in the repository-local `.env`, and mark it external:

```dotenv
COUCHDB_URL=http://127.0.0.1:5984
COUCHDB_DATABASE=utms_playwright
COUCHDB_USERNAME=<dedicated-utms-user>
COUCHDB_PASSWORD=<local-secret>
UTMS_DEV_COUCHDB=external
```

On the current development workstation, Apache CouchDB 3.5.2 is installed
under `F:\Program Files\Apache CouchDB`, runs as the automatic `Apache CouchDB`
Windows service, and uses a separate `utms` development account in
`etc/local.d/20-utms-development.ini`. The original installer-created `admin`
account was preserved. The local secret remains only in ignored `.env` and the
CouchDB service configuration; it is not a production credential.

The default Compose stack contains PostgreSQL, password-protected Redis,
CouchDB, MinIO, bucket initialization, API, and Web. Worker and runner services
are enabled by their respective profiles. The current workstation uses native
CouchDB plus Compose Redis; `dev:all` reuses both and starts the four Node
runtimes without creating another CouchDB container.

## 13. Configuration Reference

The primary deployment variables are listed in `.env.example`; the table also
includes optional runtime overrides whose defaults are defined in source:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection for sessions, mappings, runs, and metadata |
| `REDIS_PORT`, `REDIS_PASSWORD` | Local/Compose Redis settings |
| `REDIS_URL` | Shared runtime Redis URL; may be supplied externally |
| `COUCHDB_URL`, `COUCHDB_PORT` | CouchDB HTTP origin and local published port |
| `COUCHDB_DATABASE` | Authoritative Playwright document database |
| `COUCHDB_USERNAME`, `COUCHDB_PASSWORD` | CouchDB service account |
| `COUCHDB_REQUEST_TIMEOUT_MS` | Couch request timeout; default 15 seconds |
| `COUCHDB_MAX_RESPONSE_BYTES` | Couch response limit; default 32 MiB |
| `UTMS_DEV_COUCHDB` | `auto`, `external`, or `optional` local startup behavior |
| `CDE_SESSION_ENCRYPTION_KEY` | AES-256-GCM key material for CDE state/challenges |
| `CDE_MAX_BODY_BYTES` | Core serialized request/response limit; default 32 MiB |
| `CDE_REQUEST_TIMEOUT_MS` | Optional Core timeout; default 60 seconds |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Private snapshot/artifact storage |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Object-store service credentials |
| `UTMS_OBJECT_ENCRYPTION_KEY` | Encryption key for source snapshots/artifacts |
| `UTMS_INTERNAL_JOB_TOKEN` | Worker-to-API internal endpoint authentication |
| `API_CONSOLE_PORT` | API port, default 4174 |
| `WEB_PORT` | Web port, default 5173 |
| `UTMS_DEV_REDIS` | Set to `external` to forbid embedded Redis fallback |
| `UTMS_DEV_REDIS_MAXMEMORY` | Embedded-development Redis memory limit |

Production must replace all development defaults with secret-managed values.
Do not commit a populated `.env`.

## 14. Security Invariants

Future changes must preserve these properties:

- Production authorization is derived from an opaque server session.
- Every state mutation is CSRF-protected.
- CDE passwords and cellphones are not persisted or logged.
- CDE cookies remain in an encrypted server-side jar and never go to the
  browser or runner.
- Couch credentials remain server-side; CouchDB is never called by the browser
  or runner.
- The CDE adapter can reach only the fixed origin, endpoints, and allowlisted
  providers.
- Browser-supplied project, repository, package, and branch choices are
  revalidated against live Core results.
- API Module `actions` is text and is never evaluated.
- Source paths are normalized and checked for traversal/collision.
- Couch writes use `_rev`, path locks, binding checks, and post-save hash
  verification; Core writes are disabled.
- The runner uses argument-array process creation, not shell interpolation.
- The runner uses immutable snapshot input and cannot fetch live CDE code.
- Source snapshots and artifacts are encrypted in private object storage.
- Credentials or session samples from investigation never enter documentation,
  fixtures, logs, or source control.

## 15. Verification Evidence

The implementation work completed the following local checks:

- 10/10 focused CDE/CouchDB contract tests after the storage change;
- 31/31 API self-check assertions;
- workspace type checking;
- API, Web, worker, and runner builds;
- formatter/lint/diff hygiene checks;
- an earlier local smoke subset, 2/2.

The CDE contract suite covers POST-only routing, provider-prefix removal,
headers/referers, absence of editor headers on login, stable client IDs and
cookies, supplied response shapes, direct project derivation, nested file
normalization, ecreq round-trip,
logical HTTP-200 errors, disabled Core writes, CouchDB binding fingerprints,
document revisions, and provider rejection.

These tests use controlled Core responses. They do not replace the opt-in live
smoke test with a dedicated account, CouchDB, mapping, and non-production
environment.

An npm audit observed two high React Router advisories concerning React Server
Components. This application is a client-side Vite SPA and does not use React
Server Components, but dependency advisories should still be rechecked during
the next upgrade rather than treated as permanently irrelevant.

## 16. Known Limitations and Operational Work Remaining

1. A System Administrator must create an enabled mapping for each UTMS
   Application that should manage Playwright files or runs.
2. CouchDB must be reachable and initialized with server-side credentials.
3. At least one enabled deployed environment profile is required for a run.
4. The local database observation on 2026-08-08 found no CDE mapping and no
   environment for Application
   `ef550303-5a9d-4f0b-99d3-0d8f47cb8295` (`INQUERY`). That observation is not
   a permanent schema fact; an administrator can configure it later.
5. A live end-to-end CouchDB save/snapshot/run has not been performed by the
   implementing agent.
6. Message Consumer uses the inferred corresponding Core provider. Its catalog
   failure is isolated until a live configured project confirms the exact
   response shape.
7. The current source viewer is functional and read-only, but it is a package
   path/file viewer rather than a full IDE.
8. Container resource/network restrictions must be verified in the actual
   deployment platform, not only in Node runtime code.
9. Previous CDE-source test rows are legacy read-only rows; automatic migration
   into CouchDB is intentionally not implemented because the user must choose
   the correct project binding.
10. `frontbuild.json` and `dservicebuild.json` were intentionally not treated as
   protocol definitions and remain untouched.

## 17. Troubleshooting Guide

### Project selector is empty

- Confirm UTMS login is active.
- Confirm CDE status says connected.
- Inspect `GET /api/cde/projects`.
- If it returns `CDE_RECONNECT_REQUIRED`, reconnect the CDE account.
- If it returns an empty array, Core returned no project strings from
  `cde/repository/list/my-repo` for that account.

### Project appears but no Web UI package appears

- Inspect the `WEB_UI` entry from
  `GET /api/cde/projects/:projectKey/catalog`.
- Confirm the derived repository is exactly `<projectKey>/web-ui`.
- A repository-specific error should appear on that entry without hiding the
  other repository types.

### Package says branch selection is required

- Use the `branches` array returned in the 409 details.
- Submit the exact `PUBLIC` or `PERSONAL` selector when opening the package.
- Do not choose by sorting `versionId` values.

### `/playwright/files` returns `CDE_MAPPING_NOT_FOUND`

- Live browsing can still work; this error applies to managed test files.
- Select an Application from `GET /api/cde/applications`, not an arbitrary CDE
  project.
- If the desired Application is absent, an administrator must create and
  validate its project mapping and CouchDB connection.

### Browser receives 404 after code was changed

- Verify the response category rather than assuming the route is missing.
- Restart `npm.cmd run dev:all`; the API process does not hot reload.
- Confirm Vite is on 5173 and API is on 4174. Do not continue on an automatic
  fallback port.

### Redis connection refused

- Prefer `npm.cmd run dev:all`, which prepares Redis before workers start.
- If `REDIS_URL` is set, the launcher treats it as intentional and requires it
  to be reachable.
- Unset it for embedded development Redis, or start the configured external
  Redis.

### Save returns `COUCHDB_WRITE_CONFLICT`

- Reload the document and obtain its current `_rev`.
- Reapply the edit against that revision.
- Do not automatically retry a stale document body.

### Playwright files return `COUCHDB_UNAVAILABLE`

- Run `docker compose up -d couchdb` or start the configured external CouchDB.
- Verify `COUCHDB_URL`, database, username, and password.
- `npm.cmd run dev:all` starts the local Compose service automatically unless
  the URL is explicitly external or CouchDB was marked optional.

## 18. Recommended Continuation Sequence

1. Rotate any credential exposed during investigation.
2. Start PostgreSQL, apply both CDE/Playwright migrations, and start CouchDB.
3. Start the stack with `npm.cmd run dev:all` and confirm CouchDB plus all four
   runtime ready logs.
4. Log in to UTMS and connect a dedicated CDE account.
5. Verify direct browsing with `medu-inquiry` or another disposable accessible
   project: project list, Web UI catalog, package, automatic single branch, and
   nested source files.
6. As System Administrator, map the Application to the exact CDE project and
   validate both project access and CouchDB health.
7. Add a non-production environment profile.
8. Create a small Playwright spec, edit it with its current `expectedRevision`,
   refetch, and confirm `_rev` and the source hash changed.
9. Start a snapshot/run and verify queue transitions, JSON report, screenshot or
   trace evidence, cancellation, and 24-hour purge behavior.
10. Add the live smoke as opt-in automation without embedding credentials.

## 19. Code Ownership Map for the Next Agent

| Concern | Primary source |
| --- | --- |
| Core endpoint/provider transport | `apps/api/src/modules/cde/core-client.cjs` |
| Encrypted CDE session/challenge storage | `apps/api/src/modules/cde/cde-session-store.cjs` |
| Distributed CouchDB path lock | `apps/api/src/modules/cde/cde-write-lock.cjs` |
| Repository, branch, mapping, file, snapshot, run HTTP logic | `apps/api/src/modules/cde/cde-server.cjs` |
| Source path normalizer and legacy Data Service compiler | `apps/api/src/modules/cde/data-service-compiler.cjs` |
| UTMS session/CSRF/password migration | `apps/api/src/modules/auth/auth-session-server.cjs` |
| Queue producers/cancellation | `apps/api/src/modules/playwright/playwright-queue.cjs` |
| CouchDB test document store and CDE binding | `apps/api/src/modules/playwright/couchdb-test-store.cjs` |
| Encrypted object storage | `apps/api/src/modules/playwright/object-store.cjs` |
| Snapshot worker | `apps/worker/src/runtime.mjs` |
| Playwright executor | `apps/playwright-runner/src/runtime.mjs` |
| Prisma models | `database/prisma/schema.prisma` |
| Initial CDE/Playwright migration | `database/prisma/migrations/20260803130000_live_cde_playwright/` |
| CouchDB storage migration | `database/prisma/migrations/20260808110000_couchdb_playwright_store/` |
| Browser API client | `apps/web/src/services/platformApi.ts` |
| Project/test-file UI | `apps/web/src/pages/PlaywrightFilesPage.tsx` |
| Core contract tests | `apps/api/test/cde-contract.test.cjs` |
| Local four-runtime launcher | `scripts/development/dev-all.cjs` |
| Compose services | `docker-compose.yml` |

Before modifying this subsystem, an agent should read this document and the
specific source files above, inspect current migrations and local configuration,
and distinguish a direct browsing bug from a missing managed-testing mapping.

## 20. Progress Timeline

- **2026-08-03:** Core traffic and response shapes were analyzed. The live CDE
  transport, session broker, mapping schema, initial CDE-backed test-write
  approach, snapshots, worker, runner, object storage, and UI were implemented.
  The test-write portion of that approach was superseded by CouchDB on
  2026-08-08.
- **2026-08-08:** Local development failures were traced to missing Redis and
  stale processes on ports 5173/4174. The `dev:all` launcher gained Redis
  preparation, port preflight, and reliable Windows process-tree cleanup.
- **2026-08-08:** The 113-byte `/playwright/files` 404 was identified as
  `CDE_MAPPING_NOT_FOUND`, not a malformed Core request. Direct project browsing
  was separated from mapped test management, with new `/api/cde/projects`
  routes and a corrected Web UI flow.
- **2026-08-08:** The writable-CDE-test-package assumption was rejected.
  Playwright source moved to an UTMS-owned CouchDB store with exact CDE project
  bindings, `_rev` concurrency, snapshot revision-set checks, Compose
  provisioning, and Core package writes removed from the allowlist.
- **2026-08-08:** This source-verified handoff record was added so future agents
  have one canonical account of the protocol, architecture, fixes, verification,
  and remaining live work.
- **2026-08-08:** Native Apache CouchDB 3.5.2 was connected on port 5984 with a
  dedicated local UTMS account; Compose Redis was started, the Windows
  `npm-cli.js` launcher was corrected, and Web/API/worker/runner were verified
  live on ports 5173/4174 with CouchDB-backed storage healthy.
- **2026-08-08:** Manual CDE root/project inputs in Application administration
  were replaced with the same live project list used by the Playwright
  workbench. Project selection now derives editor links and repository mapping
  and persists the exact mapping during Application create/edit.
