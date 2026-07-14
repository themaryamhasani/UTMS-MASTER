# Legacy Component Tracker

| Legacy Component | Current Path | Replacement | Parity Status | Tests | Final Action |
| --- | --- | --- | --- | --- | --- |
| Single-file API Console backend | `server/api-console-server.cjs` | `apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs` transitional adapter | Runtime parity preserved; clean domain decomposition pending | `npm run backend:self-check` | Migrate internals into domain/application/presentation slices, then remove adapter. |
| API Console DOCX template | `server/templates/api-console-document-template.docx` | `apps/api/src/modules/api-console/infrastructure/templates/api-console-document-template.docx` | Complete | API self-check DOCX generation case | Keep as module infrastructure asset. |
| API Console file-backed data location | `server/data` | `runtime/api-console` | Runtime path isolated from source | API self-check secret persistence case | Replace with database-backed repository before production. |
| Frontend in-memory service layer | `src/services/api.ts` | `apps/web/src/services/api.ts` | Behavior preserved | `npm run build:web`, `npm run typecheck -w @utms/web` | Replace with HTTP-backed feature API modules as backend modules mature. |
| Frontend seed dataset | `src/data/mockData.ts` | `apps/web/src/services/seedData.ts` | Behavior preserved | Frontend build/typecheck | Replace with backend fixtures or database seed data. |
| Large API Console page | `src/pages/OnlineApiConsolePage.tsx` | `apps/web/src/pages/OnlineApiConsolePage.tsx` | Behavior preserved | Frontend build/typecheck | Split into `features/api-console` components/hooks/pages. |
| Root generated build output | `dist/` | App-local generated output ignored by `.gitignore` | Not runtime source | Root cleanliness check | Delete root copy. |
| Root runtime logs | `logs/` | Ignored runtime/artifact output | Not runtime source | Root cleanliness check | Delete root copy. |
| Root archive | `UTMS.rar` | `artifacts/archive/UTMS.rar` | Archived | Root cleanliness check | Keep ignored archive outside source ownership. |
