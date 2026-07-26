ALTER TYPE "BugSeverity" ADD VALUE IF NOT EXISTS 'BLOCKER' BEFORE 'CRITICAL';
ALTER TYPE "VersionHistoryStatus" ADD VALUE IF NOT EXISTS 'SECURITY_REVIEW' AFTER 'QA_REVIEW';
ALTER TYPE "QAQualityStatus" ADD VALUE IF NOT EXISTS 'RETEST_REQUIRED';

ALTER TABLE "test_requests"
  ADD COLUMN "security_test_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "security_test_configuration" JSONB,
  ADD COLUMN "security_requested_by_id" TEXT,
  ADD COLUMN "security_requested_at" TIMESTAMPTZ(6);

ALTER TABLE "version_histories"
  ADD COLUMN "qa_retest_requested_at" TIMESTAMPTZ(6),
  ADD COLUMN "qa_retest_requested_by_id" TEXT,
  ADD COLUMN "qa_retest_baseline_run_count" INTEGER;

ALTER TABLE "security_reviews" ADD COLUMN "test_request_id" TEXT;
ALTER TABLE "security_reviews" ADD COLUMN "test_request_title" VARCHAR(500);

UPDATE "security_reviews" AS review
SET
  "test_request_id" = test_case."test_request_id",
  "test_request_title" = request."title"
FROM "test_cases" AS test_case
JOIN "test_requests" AS request ON request."id" = test_case."test_request_id"
WHERE review."test_case_id" = test_case."id";

DELETE FROM "security_reviews" WHERE "test_request_id" IS NULL;

DELETE FROM "security_reviews" AS duplicate
USING "security_reviews" AS keeper
WHERE duplicate."test_request_id" = keeper."test_request_id"
  AND duplicate."id" > keeper."id";

ALTER TABLE "security_reviews"
  ALTER COLUMN "test_request_id" SET NOT NULL,
  ALTER COLUMN "test_request_title" SET NOT NULL;

DROP INDEX IF EXISTS "security_reviews_test_case_id_key";
ALTER TABLE "security_reviews" DROP CONSTRAINT IF EXISTS "security_reviews_test_case_id_fkey";
ALTER TABLE "security_reviews" DROP COLUMN "test_case_id";
ALTER TABLE "security_reviews" DROP COLUMN "test_case_title";

CREATE UNIQUE INDEX "security_reviews_test_request_id_key"
  ON "security_reviews"("test_request_id");

ALTER TABLE "test_requests"
  ADD CONSTRAINT "test_requests_security_requested_by_id_fkey"
  FOREIGN KEY ("security_requested_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "version_histories"
  ADD CONSTRAINT "version_histories_qa_retest_requested_by_id_fkey"
  FOREIGN KEY ("qa_retest_requested_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "security_reviews"
  ADD CONSTRAINT "security_reviews_test_request_id_fkey"
  FOREIGN KEY ("test_request_id") REFERENCES "test_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
