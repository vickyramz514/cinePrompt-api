-- Remove legacy CinePrompt video generation pipeline tables.

DROP TABLE IF EXISTS "JobStep" CASCADE;
DROP TABLE IF EXISTS "VideoJob" CASCADE;
DROP TABLE IF EXISTS "CreditLock" CASCADE;
DROP TABLE IF EXISTS "ApiCostLog" CASCADE;
DROP TABLE IF EXISTS "AbuseLog" CASCADE;

DROP TYPE IF EXISTS "JobStepStatus";
DROP TYPE IF EXISTS "JobStepType";
DROP TYPE IF EXISTS "VideoJobStatus";
