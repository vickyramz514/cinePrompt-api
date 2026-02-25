-- Enterprise Schema Migration - CinePrompt AI
-- Preserves existing data, adds new tables and columns

-- =============================================================================
-- ENUMS
-- =============================================================================
CREATE TYPE "UserRole" AS ENUM ('USER', 'CREATOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "JobStepType" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'AI_GENERATION', 'RENDERING', 'UPLOADING', 'COMPLETED', 'FAILED');
CREATE TYPE "JobStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED', 'RETRYING');
CREATE TYPE "TransactionType" AS ENUM ('VIDEO_GENERATION', 'VIDEO_REFUND', 'PURCHASE', 'SUBSCRIPTION', 'BONUS', 'ADMIN_ADJUSTMENT', 'REFERRAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE', 'TRIALING');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'DISPUTED');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'RAZORPAY', 'PAYPAL', 'MANUAL');
CREATE TYPE "NotificationType" AS ENUM ('JOB_COMPLETED', 'JOB_FAILED', 'CREDITS_LOW', 'SUBSCRIPTION_RENEWAL', 'PAYMENT_RECEIVED', 'SYSTEM_ANNOUNCEMENT');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'PUSH');
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Extend VideoJobStatus (run once; may fail if values exist)
DO $$ BEGIN
  ALTER TYPE "VideoJobStatus" ADD VALUE 'QUEUED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "VideoJobStatus" ADD VALUE 'CANCELLED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend TransactionStatus
DO $$ BEGIN
  ALTER TYPE "TransactionStatus" ADD VALUE 'REVERSED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- USER ALTERATIONS
-- =============================================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- =============================================================================
-- REFRESH TOKEN ALTERATIONS
-- =============================================================================
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- =============================================================================
-- USER PROFILE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "company" TEXT,
    "website" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "locale" TEXT DEFAULT 'en',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE INDEX IF NOT EXISTS "UserProfile_userId_idx" ON "UserProfile"("userId");
ALTER TABLE "UserProfile" DROP CONSTRAINT IF EXISTS "UserProfile_userId_fkey";
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- WALLET & CREDIT LEDGER
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsIn" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsOut" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_key" ON "Wallet"("userId");
CREATE INDEX IF NOT EXISTS "Wallet_userId_idx" ON "Wallet"("userId");
CREATE INDEX IF NOT EXISTS "Wallet_balance_idx" ON "Wallet"("balance");
ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_userId_fkey";
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill Wallet from User.credits
INSERT INTO "Wallet" ("id", "userId", "balance", "totalCreditsIn", "totalCreditsOut", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", COALESCE("credits", 50), COALESCE("credits", 50), 0, 0, NOW(), NOW()
FROM "User"
WHERE NOT EXISTS (SELECT 1 FROM "Wallet" w WHERE w."userId" = "User"."id");

CREATE TABLE IF NOT EXISTS "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "referenceId" TEXT,
    "referenceType" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CreditLedgerEntry_walletId_idx" ON "CreditLedgerEntry"("walletId");
CREATE INDEX IF NOT EXISTS "CreditLedgerEntry_createdAt_idx" ON "CreditLedgerEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "CreditLedgerEntry_type_idx" ON "CreditLedgerEntry"("type");
CREATE INDEX IF NOT EXISTS "CreditLedgerEntry_referenceId_referenceType_idx" ON "CreditLedgerEntry"("referenceId", "referenceType");
CREATE INDEX IF NOT EXISTS "CreditLedgerEntry_walletId_createdAt_idx" ON "CreditLedgerEntry"("walletId", "createdAt");
ALTER TABLE "CreditLedgerEntry" DROP CONSTRAINT IF EXISTS "CreditLedgerEntry_walletId_fkey";
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CreditUsageLog" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "jobId" TEXT,
    "planId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditUsageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CreditUsageLog_walletId_idx" ON "CreditUsageLog"("walletId");
CREATE INDEX IF NOT EXISTS "CreditUsageLog_jobId_idx" ON "CreditUsageLog"("jobId");
CREATE INDEX IF NOT EXISTS "CreditUsageLog_createdAt_idx" ON "CreditUsageLog"("createdAt");
ALTER TABLE "CreditUsageLog" DROP CONSTRAINT IF EXISTS "CreditUsageLog_walletId_fkey";
ALTER TABLE "CreditUsageLog" ADD CONSTRAINT "CreditUsageLog_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- VIDEO JOB ALTERATIONS
-- =============================================================================
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "creditsCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "resolution" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "aspectRatio" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "processingCompletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "VideoJob_status_priority_createdAt_idx" ON "VideoJob"("status", "priority", "createdAt");
CREATE INDEX IF NOT EXISTS "VideoJob_userId_createdAt_idx" ON "VideoJob"("userId", "createdAt");

-- =============================================================================
-- JOB STEP
-- =============================================================================
CREATE TABLE IF NOT EXISTS "JobStep" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stepType" "JobStepType" NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "status" "JobStepStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "error" TEXT,
    "errorCode" TEXT,
    "inputData" JSONB,
    "outputData" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "workerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JobStep_jobId_idx" ON "JobStep"("jobId");
CREATE INDEX IF NOT EXISTS "JobStep_jobId_stepOrder_idx" ON "JobStep"("jobId", "stepOrder");
CREATE INDEX IF NOT EXISTS "JobStep_status_idx" ON "JobStep"("status");
CREATE INDEX IF NOT EXISTS "JobStep_stepType_status_idx" ON "JobStep"("stepType", "status");
CREATE INDEX IF NOT EXISTS "JobStep_createdAt_idx" ON "JobStep"("createdAt");
ALTER TABLE "JobStep" DROP CONSTRAINT IF EXISTS "JobStep_jobId_fkey";
ALTER TABLE "JobStep" ADD CONSTRAINT "JobStep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- VIDEO ASSET
-- =============================================================================
CREATE TABLE IF NOT EXISTS "VideoAsset" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VideoAsset_jobId_idx" ON "VideoAsset"("jobId");
CREATE INDEX IF NOT EXISTS "VideoAsset_assetType_idx" ON "VideoAsset"("assetType");
ALTER TABLE "VideoAsset" DROP CONSTRAINT IF EXISTS "VideoAsset_jobId_fkey";
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- TRANSACTION INDEX
-- =============================================================================
CREATE INDEX IF NOT EXISTS "Transaction_type_idx" ON "Transaction"("type");
CREATE INDEX IF NOT EXISTS "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- =============================================================================
-- SUBSCRIPTION & PAYMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "creditsPerMonth" INTEGER,
    "billingCycle" TEXT,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_slug_idx" ON "SubscriptionPlan"("slug");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

CREATE TABLE IF NOT EXISTS "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSubscription_userId_planId_key" ON "UserSubscription"("userId", "planId");
CREATE INDEX IF NOT EXISTS "UserSubscription_userId_idx" ON "UserSubscription"("userId");
CREATE INDEX IF NOT EXISTS "UserSubscription_planId_idx" ON "UserSubscription"("planId");
CREATE INDEX IF NOT EXISTS "UserSubscription_status_idx" ON "UserSubscription"("status");
CREATE INDEX IF NOT EXISTS "UserSubscription_currentPeriodEnd_idx" ON "UserSubscription"("currentPeriodEnd");
ALTER TABLE "UserSubscription" DROP CONSTRAINT IF EXISTS "UserSubscription_userId_fkey";
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSubscription" DROP CONSTRAINT IF EXISTS "UserSubscription_planId_fkey";
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL,
    "providerId" TEXT,
    "providerData" JSONB,
    "creditsAdded" INTEGER,
    "subscriptionId" TEXT,
    "invoiceUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_provider_providerId_idx" ON "Payment"("provider", "providerId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_userId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- API USAGE
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ApiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "creditsUsed" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApiUsage_userId_idx" ON "ApiUsage"("userId");
CREATE INDEX IF NOT EXISTS "ApiUsage_endpoint_idx" ON "ApiUsage"("endpoint");
CREATE INDEX IF NOT EXISTS "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");
CREATE INDEX IF NOT EXISTS "ApiUsage_userId_createdAt_idx" ON "ApiUsage"("userId", "createdAt");
ALTER TABLE "ApiUsage" DROP CONSTRAINT IF EXISTS "ApiUsage_userId_fkey";
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_channel_type_key" ON "NotificationPreference"("userId", "channel", "type");
CREATE INDEX IF NOT EXISTS "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");
ALTER TABLE "NotificationPreference" DROP CONSTRAINT IF EXISTS "NotificationPreference_userId_fkey";
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- ERROR LOG & SYSTEM
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ErrorLog" (
    "id" TEXT NOT NULL,
    "severity" "ErrorSeverity" NOT NULL DEFAULT 'MEDIUM',
    "code" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ErrorLog_severity_idx" ON "ErrorLog"("severity");
CREATE INDEX IF NOT EXISTS "ErrorLog_code_idx" ON "ErrorLog"("code");
CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSettings_key_key" ON "SystemSettings"("key");
CREATE INDEX IF NOT EXISTS "SystemSettings_key_idx" ON "SystemSettings"("key");
CREATE INDEX IF NOT EXISTS "SystemSettings_category_idx" ON "SystemSettings"("category");

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SystemMetrics" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemMetrics_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SystemMetrics_metric_idx" ON "SystemMetrics"("metric");
CREATE INDEX IF NOT EXISTS "SystemMetrics_timestamp_idx" ON "SystemMetrics"("timestamp");
CREATE INDEX IF NOT EXISTS "SystemMetrics_metric_timestamp_idx" ON "SystemMetrics"("metric", "timestamp");
