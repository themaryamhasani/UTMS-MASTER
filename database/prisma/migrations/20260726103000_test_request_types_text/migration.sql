ALTER TABLE "test_requests"
  ALTER COLUMN "test_types" DROP DEFAULT,
  ALTER COLUMN "test_types" TYPE TEXT[]
    USING ("test_types"::TEXT)::TEXT[],
  ALTER COLUMN "test_types" SET DEFAULT ARRAY[]::TEXT[];
