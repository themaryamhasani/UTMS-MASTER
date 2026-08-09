ALTER TABLE "application_environments"
  ADD COLUMN "available_from" TIMESTAMPTZ(6),
  ADD COLUMN "available_until" TIMESTAMPTZ(6);

ALTER TABLE "application_environments"
  ADD CONSTRAINT "application_environments_availability_range_check"
  CHECK (
    "available_from" IS NULL
    OR "available_until" IS NULL
    OR "available_until" > "available_from"
  );

CREATE INDEX "application_environments_application_availability_idx"
  ON "application_environments"("application_id", "available_from", "available_until");
