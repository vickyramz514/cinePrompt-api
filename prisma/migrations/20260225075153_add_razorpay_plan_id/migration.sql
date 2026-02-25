-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'GITHUB', 'APPLE');

-- DropIndex
DROP INDEX "User_provider_idx";

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "razorpayPlanId" TEXT;

-- AlterTable
ALTER TABLE "SystemSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "credits" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "SubscriptionPlan_razorpayPlanId_idx" ON "SubscriptionPlan"("razorpayPlanId");

-- CreateIndex
CREATE INDEX "User_provider_providerId_idx" ON "User"("provider", "providerId");

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "VideoJob_replicateId_idx" ON "VideoJob"("replicateId");
