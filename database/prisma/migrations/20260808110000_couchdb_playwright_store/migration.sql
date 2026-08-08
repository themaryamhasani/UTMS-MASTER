-- Playwright source is now authoritative in CouchDB rather than a writable CDE package.
ALTER TYPE "PlaywrightTestFileSource" ADD VALUE IF NOT EXISTS 'COUCHDB';

ALTER TABLE "cde_application_mappings"
  ALTER COLUMN "test_repo_name" DROP NOT NULL,
  ALTER COLUMN "test_pack_id" DROP NOT NULL;

ALTER TABLE "playwright_test_files"
  ADD COLUMN "couch_document_id" TEXT,
  ADD COLUMN "couch_revision" VARCHAR(255),
  ADD COLUMN "cde_binding" JSONB;

CREATE UNIQUE INDEX "playwright_test_files_couch_document_id_key"
  ON "playwright_test_files"("couch_document_id");
