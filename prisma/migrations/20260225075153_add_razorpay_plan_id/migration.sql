-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'GITHUB', 'APPLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "User_provider_idx";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "credits" SET DEFAULT 0;

-- CreateIndex (providerId, isActive added in enterprise_schema)
CREATE INDEX IF NOT EXISTS "User_plan_idx" ON "User"("plan");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX IF NOT EXISTS "VideoJob_replicateId_idx" ON "VideoJob"("replicateId");
