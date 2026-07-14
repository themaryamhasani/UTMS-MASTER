# Phase 13 Integration and Runner Settings Notes

This document records the frontend/mock implementation boundary for modular integration and runner configuration.

## Implemented Mock Behavior

- Shared settings types were added for:
  - Playwright runner configuration
  - CDE adapter configuration
  - FAVA adapter configuration
- Mock `systemSettingsApi` exposes:
  - read integration settings
  - update Playwright runner settings
  - update each external adapter
- Settings page now manages:
  - Playwright feature flag
  - Playwright auto-discovery flag
  - runner id
  - command template
  - working directory
  - default timeout
  - artifact root
  - secret reference
  - CDE/FAVA base URL, credential reference, sync direction, and enabled flag
- Application Back-office now stores three CDE test roots per system:
  - Front root URL, e.g. `https://cde.edus.ir/front/directory/medu-community%3EApp`
  - Back NodeJS / DataService root URL, e.g. `https://cde.edus.ir/dservice/directory/medu-community%3EApp`
  - Gateway root URL
- Current gateway URL pattern: `https://cde.edus.ir/back/medu-ai/medu-community%3E?return=/workspace/medu-ai`.
- Playwright run creation reads the runner configuration for command, working directory, timeout, runner id, artifact paths, and user-selected Playwright command options.
- The Playwright start form exposes Browser/Project, headed mode, workers, retries, max failures, trace, and reporter as UI controls and converts them to command options.
- Playwright discovery reads test files from the configured Application CDE roots when they exist; otherwise it falls back to the mock repository file list.
- Test files created or edited in the Playwright Files cartable are also selectable from the Playwright run form. They remain selectable even when auto-discovery is disabled.
- Playwright discovery and start are disabled when the Playwright feature flag is off.
- Reporter selection is operational in the mock runner:
  - HTML creates `playwright-report.html` with `text/html`.
  - JSON creates `playwright-report.json` with `application/json`.
  - JUnit creates `playwright-report.xml` with `application/xml`.
- The Playwright run detail modal previews the selected report format, supports report download, removes duplicate report artifact display, and shows named Passed, Skipped, Cancelled, and Failed test details.

## Backend Boundary

Production should persist integration and runner settings per environment/application policy as needed.

Secrets must remain references only. The browser must never receive raw credentials.

Runner workers and integration workers should resolve secret references server-side and write audit/command trace records when settings change.
