-- ApiCostLog, CreditLock, AbuseLog tables (missing from enterprise_schema)
CREATE TABLE IF NOT EXISTS "CreditLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CreditLock_jobId_key" ON "CreditLock"("jobId");
CREATE INDEX IF NOT EXISTS "CreditLock_userId_idx" ON "CreditLock"("userId");
CREATE INDEX IF NOT EXISTS "CreditLock_status_idx" ON "CreditLock"("status");
CREATE INDEX IF NOT EXISTS "CreditLock_userId_status_idx" ON "CreditLock"("userId", "status");

CREATE TABLE IF NOT EXISTS "ApiCostLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiCostLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApiCostLog_userId_idx" ON "ApiCostLog"("userId");
CREATE INDEX IF NOT EXISTS "ApiCostLog_provider_idx" ON "ApiCostLog"("provider");
CREATE INDEX IF NOT EXISTS "ApiCostLog_createdAt_idx" ON "ApiCostLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ApiCostLog_userId_createdAt_idx" ON "ApiCostLog"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "AbuseLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbuseLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AbuseLog_userId_idx" ON "AbuseLog"("userId");
CREATE INDEX IF NOT EXISTS "AbuseLog_type_idx" ON "AbuseLog"("type");
CREATE INDEX IF NOT EXISTS "AbuseLog_createdAt_idx" ON "AbuseLog"("createdAt");
