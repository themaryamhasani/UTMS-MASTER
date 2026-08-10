# Repository Structure

Source-verified: 2026-08-10

```text
utms/
|-- apps/
|   |-- api/                 Node HTTP API and backend adapters
|   `-- web/                 React/Vite frontend
|-- packages/
|   |-- config/
|   |-- contracts/
|   |-- shared/
|   `-- test-support/
|-- database/prisma/         schema, migrations and seed
|-- infrastructure/
|   |-- compose/
|   `-- docker/
|-- scripts/
|   |-- database/
|   |-- development/
|   |-- testing/
|   `-- verification/
|-- performance/             k6 harness
|-- docs/
|-- tests/                   cross-cutting QA suites
|-- docker-compose.yml
|-- package.json
|-- playwright.config.ts     UTMS test harness only
`-- prisma.config.ts
```

اپ‌های execution/runner و زیرساخت دادهٔ آن‌ها در این repository وجود ندارند.
مقصد مستقل در <https://github.com/themaryamhasani/playwright-studio> است.

## Boundaries

- frontend نباید implementation بک‌اند را import کند.
- production source نباید `test-support` را import کند.
- shared contract/utility نباید به framework یا environment وابسته باشد.
- generated/runtime directories منبع کد نیستند.
- module جدید API باید زیر `apps/api/src/modules/<name>` و persistence آن در همان
  bounded context قرار گیرد.

Domain RPC bundling کد service سمت frontend یک استثنای transitional موجود است و
نباید گسترش یابد. مرجع اجرایی [Current Implementation](CURRENT_IMPLEMENTATION.md) است.
