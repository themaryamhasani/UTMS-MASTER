UPDATE "test_requests"
SET
  "status" = 'COMPLETED',
  "updated_at" = CURRENT_TIMESTAMP
WHERE
  "release_decision" IN ('APPROVED', 'CONDITIONAL')
  AND "status" IN ('ACCEPTED', 'IN_PROGRESS');
