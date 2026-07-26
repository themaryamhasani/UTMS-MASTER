ALTER TYPE "SecurityReviewStatus" ADD VALUE IF NOT EXISTS 'NEEDS_QA_REVIEW';
ALTER TYPE "SecurityReviewStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED_TO_QA';
ALTER TYPE "SecurityReviewStatus" ADD VALUE IF NOT EXISTS 'DEVELOPER_FIX';
ALTER TYPE "SecurityReviewStatus" ADD VALUE IF NOT EXISTS 'FIXED_PENDING_QA';
ALTER TYPE "SecurityReviewStatus" ADD VALUE IF NOT EXISTS 'QA_REPORT_REVIEW';
ALTER TYPE "SecurityReviewStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_SECURITY';

UPDATE "security_review_items"
SET "result" = 'PARTIAL'
WHERE "result" = 'NOT_TESTED';

ALTER TYPE "SecurityReviewItemResult" RENAME TO "SecurityReviewItemResult_old";

CREATE TYPE "SecurityReviewItemResult" AS ENUM ('PASS', 'FAIL', 'PARTIAL', 'N_A');

ALTER TABLE "security_review_items"
ALTER COLUMN "result" TYPE "SecurityReviewItemResult"
USING ("result"::text::"SecurityReviewItemResult");

DROP TYPE "SecurityReviewItemResult_old";

CREATE TYPE "SecurityExecutionStatus" AS ENUM ('ASSIGNED_TO_DEVELOPER', 'FIXED');

ALTER TABLE "security_reviews"
ADD COLUMN "assigned_qa_specialist_id" TEXT,
ADD COLUMN "security_evidence_attachment_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "qa_report_attachment_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "follow_up_started_at" TIMESTAMPTZ(6),
ADD COLUMN "last_action_notes" TEXT;

CREATE TABLE "security_executions" (
  "id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT NOT NULL,
  "developer_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "status" "SecurityExecutionStatus" NOT NULL,
  "resolution" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  CONSTRAINT "security_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_review_transitions" (
  "id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "actor_id" TEXT NOT NULL,
  "from_status" "SecurityReviewStatus",
  "to_status" "SecurityReviewStatus" NOT NULL,
  "notes" TEXT,
  "attachment_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_review_transitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_executions_review_id_status_idx"
ON "security_executions"("review_id", "status");

CREATE INDEX "security_executions_developer_id_status_idx"
ON "security_executions"("developer_id", "status");

CREATE INDEX "security_review_transitions_review_id_created_at_idx"
ON "security_review_transitions"("review_id", "created_at");

CREATE INDEX "security_review_transitions_actor_id_created_at_idx"
ON "security_review_transitions"("actor_id", "created_at");

ALTER TABLE "security_executions"
ADD CONSTRAINT "security_executions_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "security_reviews"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_review_transitions"
ADD CONSTRAINT "security_review_transitions_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "security_reviews"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
