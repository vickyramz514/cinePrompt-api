-- Add missing VideoJob columns (cost, cdnUrl, runwayId, negativePrompt)
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "cdnUrl" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "runwayId" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "negativePrompt" TEXT;
CREATE INDEX IF NOT EXISTS "VideoJob_runwayId_idx" ON "VideoJob"("runwayId");
