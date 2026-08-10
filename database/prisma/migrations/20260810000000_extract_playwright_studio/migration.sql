-- DESTRUCTIVE CUTOVER MIGRATION
-- Run only after the Playwright Studio export, backup and integrity checks in
-- docs/migration/PLAYWRIGHT_STUDIO_EXTRACTION.md have completed.

DELETE FROM "attachments"
WHERE "entity_type"::text IN ('PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

DELETE FROM "audit_logs"
WHERE "entity_type"::text IN ('PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

DELETE FROM "command_traces"
WHERE "entity_type"::text IN ('PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

DELETE FROM "command_idempotency_records"
WHERE "entity_type"::text IN ('PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

DELETE FROM "comments"
WHERE "entity_type"::text IN ('PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

DELETE FROM "notifications"
WHERE "entity_type"::text IN ('PLAYWRIGHT_RUN', 'PLAYWRIGHT_TEST_FILE');

DELETE FROM "integration_adapter_settings"
WHERE "provider"::text = 'CDE';

DROP TABLE IF EXISTS "playwright_runs" CASCADE;
DROP TABLE IF EXISTS "playwright_test_folders" CASCADE;
DROP TABLE IF EXISTS "playwright_test_files" CASCADE;
DROP TABLE IF EXISTS "cde_application_mappings" CASCADE;
DROP TABLE IF EXISTS "cde_branch_selections" CASCADE;
DROP TABLE IF EXISTS "application_environments" CASCADE;
DROP TABLE IF EXISTS "cde_source_snapshots" CASCADE;
DROP TABLE IF EXISTS "playwright_hidden_discovered_paths" CASCADE;
DROP TABLE IF EXISTS "playwright_runner_settings" CASCADE;

ALTER TABLE "applications"
  DROP COLUMN IF EXISTS "cde_front_url",
  DROP COLUMN IF EXISTS "cde_data_service_url",
  DROP COLUMN IF EXISTS "cde_gateway_url";

ALTER TABLE "user_role_assignments"
  DROP COLUMN IF EXISTS "automated_tests_enabled";

ALTER TYPE "EntityType" RENAME TO "EntityType_legacy";
CREATE TYPE "EntityType" AS ENUM (
  'TEST_REQUEST', 'REQUIREMENT', 'FLOW', 'TEST_CASE', 'TEST_RUN', 'BUG',
  'RETEST_TASK', 'RUN_ISSUE', 'CHECKLIST', 'VERSION_HISTORY', 'RELEASE_PUBLISH'
);
ALTER TABLE "attachments" ALTER COLUMN "entity_type" TYPE "EntityType"
  USING ("entity_type"::text::"EntityType");
ALTER TABLE "comments" ALTER COLUMN "entity_type" TYPE "EntityType"
  USING ("entity_type"::text::"EntityType");
ALTER TABLE "notifications" ALTER COLUMN "entity_type" TYPE "EntityType"
  USING ("entity_type"::text::"EntityType");
DROP TYPE "EntityType_legacy";

ALTER TYPE "SystemEntityType" RENAME TO "SystemEntityType_legacy";
CREATE TYPE "SystemEntityType" AS ENUM (
  'TEST_REQUEST', 'REQUIREMENT', 'FLOW', 'TEST_CASE', 'TEST_RUN', 'BUG',
  'RETEST_TASK', 'RUN_ISSUE', 'CHECKLIST', 'VERSION_HISTORY', 'RELEASE_PUBLISH',
  'USER', 'APPLICATION', 'ROLE_ASSIGNMENT', 'API_COLLECTION', 'API_REQUEST',
  'API_SHARE_REQUEST', 'API_EXECUTION'
);
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" TYPE "SystemEntityType"
  USING ("entity_type"::text::"SystemEntityType");
ALTER TABLE "command_traces" ALTER COLUMN "entity_type" TYPE "SystemEntityType"
  USING ("entity_type"::text::"SystemEntityType");
ALTER TABLE "command_idempotency_records" ALTER COLUMN "entity_type" TYPE "SystemEntityType"
  USING ("entity_type"::text::"SystemEntityType");
DROP TYPE "SystemEntityType_legacy";

ALTER TYPE "IntegrationProvider" RENAME TO "IntegrationProvider_legacy";
CREATE TYPE "IntegrationProvider" AS ENUM ('FAVA');
ALTER TABLE "integration_adapter_settings" ALTER COLUMN "provider" TYPE "IntegrationProvider"
  USING ("provider"::text::"IntegrationProvider");
DROP TYPE "IntegrationProvider_legacy";

DROP TYPE IF EXISTS "PlaywrightRunStatus";
DROP TYPE IF EXISTS "PlaywrightQueueStatus";
DROP TYPE IF EXISTS "PlaywrightProject";
DROP TYPE IF EXISTS "PlaywrightCdeRootKind";
DROP TYPE IF EXISTS "PlaywrightTestFileSource";
DROP TYPE IF EXISTS "CdeRepositoryType";
DROP TYPE IF EXISTS "CdeBranchKind";
DROP TYPE IF EXISTS "CdeSnapshotStatus";
