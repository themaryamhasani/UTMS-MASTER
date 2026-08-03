-- Extend existing Playwright enums without rewriting historical rows.
ALTER TYPE "PlaywrightRunStatus" ADD VALUE IF NOT EXISTS 'PREPARING' BEFORE 'PENDING';
ALTER TYPE "PlaywrightRunStatus" ADD VALUE IF NOT EXISTS 'QUEUED' BEFORE 'PENDING';
ALTER TYPE "PlaywrightCdeRootKind" ADD VALUE IF NOT EXISTS 'MESSAGE_CONSUMER';
ALTER TYPE "PlaywrightCdeRootKind" ADD VALUE IF NOT EXISTS 'TESTS';
ALTER TYPE "PlaywrightTestFileSource" ADD VALUE IF NOT EXISTS 'CDE';

CREATE TYPE "CdeRepositoryType" AS ENUM ('WEB_UI', 'DATA_SERVICE', 'API_MODULE', 'MESSAGE_CONSUMER', 'TESTS');
CREATE TYPE "CdeBranchKind" AS ENUM ('PUBLIC', 'PERSONAL');
CREATE TYPE "CdeSnapshotStatus" AS ENUM ('PENDING', 'MATERIALIZING', 'READY', 'FAILED', 'PURGED');

ALTER TABLE "playwright_runs"
  ADD COLUMN "environment_profile_id" TEXT,
  ADD COLUMN "snapshot_id" TEXT,
  ADD COLUMN "test_file_id" TEXT;

ALTER TABLE "playwright_test_files"
  ADD COLUMN "remote_repo_name" TEXT,
  ADD COLUMN "remote_pack_id" TEXT,
  ADD COLUMN "remote_branch_kind" "CdeBranchKind",
  ADD COLUMN "remote_branch_rand_id" VARCHAR(255),
  ADD COLUMN "remote_branch_index" INTEGER,
  ADD COLUMN "remote_version_id" VARCHAR(255),
  ADD COLUMN "remote_path" TEXT,
  ADD COLUMN "source_hash" VARCHAR(64),
  ADD COLUMN "synced_at" TIMESTAMPTZ(6);

CREATE TABLE "cde_application_mappings" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "service_id" VARCHAR(255) NOT NULL DEFAULT 'cde.edus.ir',
  "project_key" VARCHAR(255) NOT NULL,
  "web_ui_repo_name" TEXT,
  "data_service_repo_name" TEXT,
  "api_module_repo_name" TEXT,
  "message_consumer_repo_name" TEXT,
  "test_repo_name" TEXT NOT NULL,
  "test_pack_id" TEXT NOT NULL,
  "test_branch_rand_id" VARCHAR(255),
  "test_branch_index" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_validation_status" VARCHAR(64),
  "last_validated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cde_application_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cde_branch_selections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "repository_type" "CdeRepositoryType" NOT NULL,
  "repo_name" TEXT NOT NULL,
  "pack_id" TEXT NOT NULL,
  "branch_kind" "CdeBranchKind" NOT NULL,
  "branch_rand_id" VARCHAR(255),
  "branch_index" INTEGER,
  "last_seen_version_id" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cde_branch_selections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_environments" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "web_base_url" TEXT NOT NULL,
  "api_base_url" TEXT,
  "gateway_base_url" TEXT,
  "secret_references" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "application_environments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cde_source_snapshots" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "initiating_session_id" VARCHAR(255),
  "status" "CdeSnapshotStatus" NOT NULL DEFAULT 'PENDING',
  "manifest" JSONB NOT NULL DEFAULT '{}',
  "object_key" TEXT,
  "content_hash" VARCHAR(64),
  "error_code" VARCHAR(120),
  "error_message" TEXT,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "purged_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cde_source_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cde_application_mappings_application_id_key" ON "cde_application_mappings"("application_id");
CREATE INDEX "cde_application_mappings_project_key_enabled_idx" ON "cde_application_mappings"("project_key", "enabled");
CREATE UNIQUE INDEX "cde_branch_selections_identity_key" ON "cde_branch_selections"("user_id", "application_id", "repository_type", "repo_name", "pack_id");
CREATE INDEX "cde_branch_selections_application_type_idx" ON "cde_branch_selections"("application_id", "repository_type");
CREATE UNIQUE INDEX "application_environments_application_name_key" ON "application_environments"("application_id", "name");
CREATE INDEX "application_environments_application_enabled_idx" ON "application_environments"("application_id", "enabled");
CREATE INDEX "cde_source_snapshots_application_status_idx" ON "cde_source_snapshots"("application_id", "status");
CREATE INDEX "cde_source_snapshots_expiry_idx" ON "cde_source_snapshots"("expires_at", "purged_at");
CREATE INDEX "playwright_runs_environment_profile_id_idx" ON "playwright_runs"("environment_profile_id");
CREATE INDEX "playwright_runs_snapshot_id_idx" ON "playwright_runs"("snapshot_id");
CREATE INDEX "playwright_runs_test_file_id_idx" ON "playwright_runs"("test_file_id");
CREATE INDEX "playwright_test_files_remote_package_idx" ON "playwright_test_files"("application_id", "remote_repo_name", "remote_pack_id");

ALTER TABLE "cde_application_mappings" ADD CONSTRAINT "cde_application_mappings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cde_branch_selections" ADD CONSTRAINT "cde_branch_selections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cde_branch_selections" ADD CONSTRAINT "cde_branch_selections_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_environments" ADD CONSTRAINT "application_environments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cde_source_snapshots" ADD CONSTRAINT "cde_source_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cde_source_snapshots" ADD CONSTRAINT "cde_source_snapshots_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playwright_runs" ADD CONSTRAINT "playwright_runs_environment_profile_id_fkey" FOREIGN KEY ("environment_profile_id") REFERENCES "application_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playwright_runs" ADD CONSTRAINT "playwright_runs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "cde_source_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playwright_runs" ADD CONSTRAINT "playwright_runs_test_file_id_fkey" FOREIGN KEY ("test_file_id") REFERENCES "playwright_test_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
